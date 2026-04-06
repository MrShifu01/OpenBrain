import { useState, useRef, useEffect, useCallback } from "react";
import { TC } from "../data/constants";
import { authFetch } from "../lib/authFetch";
import {
  setupVault,
  unlockVault,
  decryptEntry,
  generateRecoveryKey,
  encryptVaultKeyForRecovery,
  decryptVaultKeyFromRecovery,
} from "../lib/crypto";
import type { Entry } from "../types";

/* ─── States: loading → setup → show-recovery → locked | recovery | unlocked ─── */

interface VaultData {
  exists: boolean;
  salt: string;
  verify_token: string;
  recovery_blob: string;
}

interface VaultViewProps {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
  cryptoKey: CryptoKey | null;
  onVaultUnlock: (key: CryptoKey | null) => void;
}

export default function VaultView({ entries, onSelect, cryptoKey, onVaultUnlock }: VaultViewProps) {
  const [status, setStatus] = useState("loading");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState("");
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [decryptedSecrets, setDecryptedSecrets] = useState<Entry[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const secrets = entries.filter((e: Entry) => e.type === "secret");

  // Check vault status on mount
  useEffect(() => {
    if (cryptoKey) {
      setStatus("unlocked");
      return;
    }
    authFetch("/api/vault")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) {
          setStatus("setup");
          return;
        }
        if (data.exists) {
          setVaultData(data);
          setStatus("locked");
        } else setStatus("setup");
      })
      .catch(() => setStatus("setup"));
  }, [cryptoKey]);

  // Decrypt secrets when unlocked
  useEffect(() => {
    if (status !== "unlocked" || !cryptoKey || secrets.length === 0) {
      setDecryptedSecrets([]);
      return;
    }
    Promise.all(secrets.map((e) => decryptEntry(e as any, cryptoKey)))
      .then((result: any[]) => setDecryptedSecrets(result))
      .catch(() => setDecryptedSecrets(secrets));
  }, [status, cryptoKey, secrets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (["setup", "locked", "recovery"].includes(status)) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [status]);

  // ── Setup: create vault + generate recovery key ──
  const handleSetup = useCallback(async () => {
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirm) {
      setError("Passphrases don't match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { key, salt, verifyToken } = await setupVault(passphrase);

      // Generate recovery key and encrypt vault key with it
      const recoveryKey = generateRecoveryKey();
      const recoveryBlob = await encryptVaultKeyForRecovery(key, recoveryKey);

      const res = await authFetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salt, verify_token: verifyToken, recovery_blob: recoveryBlob }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      // Show the recovery key before unlocking
      setGeneratedRecoveryKey(recoveryKey);
      onVaultUnlock(key);
      setStatus("show-recovery");
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }, [passphrase, confirm, onVaultUnlock]);

  // ── Unlock with passphrase ──
  const handleUnlock = useCallback(async () => {
    if (!passphrase.trim()) return;
    setBusy(true);
    setError("");
    try {
      const key = await unlockVault(passphrase, vaultData!.salt, vaultData!.verify_token);
      if (!key) {
        setError("Wrong passphrase");
        setBusy(false);
        return;
      }
      onVaultUnlock(key);
      setStatus("unlocked");
    } catch {
      setError("Decryption failed");
    }
    setBusy(false);
  }, [passphrase, vaultData, onVaultUnlock]);

  // ── Unlock with recovery key ──
  const handleRecoveryUnlock = useCallback(async () => {
    const cleaned = recoveryInput.trim().toUpperCase();
    if (!cleaned) return;
    setBusy(true);
    setError("");
    try {
      const key = await decryptVaultKeyFromRecovery(vaultData!.recovery_blob, cleaned);
      if (!key) {
        setError("Invalid recovery key");
        setBusy(false);
        return;
      }
      onVaultUnlock(key);
      setStatus("unlocked");
    } catch {
      setError("Recovery failed — check your key and try again");
    }
    setBusy(false);
  }, [recoveryInput, vaultData, onVaultUnlock]);

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg(label || "Copied");
      setTimeout(() => setCopyMsg(null), 2000);
    });
  };

  // ── Loading ──
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3" style={{ background: "#0e0e0e" }}>
        <div className="text-4xl animate-pulse">🔐</div>
        <p className="text-sm" style={{ color: "#777" }}>Checking vault...</p>
      </div>
    );
  }

  // ── Setup: passphrase creation ──
  if (status === "setup") {
    return (
      <div className="flex flex-col items-center px-4 py-12 space-y-6" style={{ background: "#0e0e0e" }}>
        <div className="text-center space-y-2">
          <div className="text-4xl">🔐</div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>Set up your Vault</h2>
          <p className="text-sm max-w-xs mx-auto" style={{ color: "#aaa" }}>
            Choose a passphrase to protect your passwords, credit cards, and sensitive data.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "#777" }}>
              Passphrase
            </label>
            <input
              ref={inputRef}
              type="password"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                setError("");
              }}
              placeholder="At least 8 characters"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-transparent border outline-none transition-colors text-white placeholder:text-[#555]"
              style={{ borderColor: "rgba(72,72,71,0.3)" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(114,239,245,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(72,72,71,0.3)")}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "#777" }}>
              Confirm passphrase
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSetup()}
              placeholder="Enter again to confirm"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-transparent border outline-none transition-colors text-white placeholder:text-[#555]"
              style={{ borderColor: "rgba(72,72,71,0.3)" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(114,239,245,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(72,72,71,0.3)")}
            />
          </div>
        </div>

        {error && <p className="text-sm text-center" style={{ color: "#ff6e84" }}>{error}</p>}

        <button
          onClick={handleSetup}
          disabled={busy || passphrase.length < 8}
          className="w-full max-w-sm rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #72eff5, #1fb1b7)",
            color: "#0a0a0a",
          }}
        >
          {busy ? "Setting up..." : "Create Vault"}
        </button>
      </div>
    );
  }

  // ── Show recovery key (after setup, before unlocked) ──
  if (status === "show-recovery") {
    return (
      <div className="flex flex-col items-center px-4 py-12 space-y-6" style={{ background: "#0e0e0e" }}>
        <div className="text-center space-y-2">
          <div className="text-4xl">🗝</div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>Your Recovery Key</h2>
          <p className="text-sm max-w-xs mx-auto" style={{ color: "#aaa" }}>
            If you ever forget your passphrase, this key is the{" "}
            <strong className="text-white">only way</strong> to recover your secrets. Write it
            down and store it somewhere safe.
          </p>
        </div>

        {/* Recovery key display */}
        <div
          className="w-full max-w-sm rounded-2xl border p-4 text-center"
          style={{ background: "rgba(38,38,38,0.6)", borderColor: "rgba(72,72,71,0.2)" }}
        >
          <p className="text-base font-mono font-bold tracking-widest" style={{ color: "#d575ff" }}>{generatedRecoveryKey}</p>
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(generatedRecoveryKey);
            setRecoveryCopied(true);
          }}
          className="w-full max-w-sm rounded-xl py-2.5 text-sm font-semibold border transition-colors hover:bg-white/5"
          style={{ color: "#aaa", borderColor: "rgba(72,72,71,0.3)" }}
        >
          {recoveryCopied ? "Copied!" : "📋 Copy recovery key"}
        </button>

        <div
          className="w-full max-w-sm rounded-2xl border p-3"
          style={{ background: "rgba(255,110,132,0.08)", borderColor: "rgba(255,110,132,0.2)" }}
        >
          <p className="text-xs" style={{ color: "#ff6e84" }}>
            <strong>Write this down now.</strong> This key will not be shown again. Without your
            passphrase or this recovery key, encrypted entries are permanently lost.
          </p>
        </div>

        <button
          onClick={() => {
            setGeneratedRecoveryKey("");
            setStatus("unlocked");
          }}
          className="w-full max-w-sm rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #72eff5, #1fb1b7)",
            color: "#0a0a0a",
          }}
        >
          I've saved my recovery key
        </button>
      </div>
    );
  }

  // ── Locked: passphrase entry ──
  if (status === "locked") {
    return (
      <div className="flex flex-col items-center px-4 py-12 space-y-5" style={{ background: "#0e0e0e" }}>
        <div className="text-center space-y-2">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>Unlock Vault</h2>
          <p className="text-sm" style={{ color: "#aaa" }}>
            Enter your vault passphrase to view secrets
          </p>
        </div>

        <input
          ref={inputRef}
          type="password"
          value={passphrase}
          onChange={(e) => {
            setPassphrase(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
          placeholder="Vault passphrase"
          className="w-full max-w-sm rounded-xl px-3 py-2.5 text-sm bg-transparent border outline-none transition-colors text-white placeholder:text-[#555]"
          style={{ borderColor: "rgba(72,72,71,0.3)" }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(114,239,245,0.5)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(72,72,71,0.3)")}
        />

        {error && <p className="text-sm" style={{ color: "#ff6e84" }}>{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={busy || !passphrase.trim()}
          className="w-full max-w-sm rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #72eff5, #1fb1b7)",
            color: "#0a0a0a",
          }}
        >
          {busy ? "Unlocking..." : "Unlock"}
        </button>

        <button
          onClick={() => {
            setError("");
            setRecoveryInput("");
            setStatus("recovery");
          }}
          className="text-xs transition-colors hover:underline"
          style={{ color: "#777" }}
        >
          Forgot passphrase? Use recovery key
        </button>

        {secrets.length > 0 && (
          <p className="text-xs" style={{ color: "#555" }}>
            {secrets.length} encrypted {secrets.length === 1 ? "entry" : "entries"} waiting
          </p>
        )}
      </div>
    );
  }

  // ── Recovery: enter recovery key ──
  if (status === "recovery") {
    return (
      <div className="flex flex-col items-center px-4 py-12 space-y-5" style={{ background: "#0e0e0e" }}>
        <div className="text-center space-y-2">
          <div className="text-4xl">🗝</div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>Recovery Key</h2>
          <p className="text-sm" style={{ color: "#aaa" }}>
            Enter the recovery key you saved when you set up your vault
          </p>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={recoveryInput}
          onChange={(e) => {
            setRecoveryInput(e.target.value.toUpperCase());
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleRecoveryUnlock()}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
          className="w-full max-w-sm rounded-xl px-3 py-2.5 text-sm bg-transparent border outline-none transition-colors text-white font-mono tracking-wider text-center placeholder:text-[#555]"
          style={{ borderColor: "rgba(72,72,71,0.3)" }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(114,239,245,0.5)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(72,72,71,0.3)")}
        />

        {error && <p className="text-sm" style={{ color: "#ff6e84" }}>{error}</p>}

        <button
          onClick={handleRecoveryUnlock}
          disabled={busy || !recoveryInput.trim()}
          className="w-full max-w-sm rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #72eff5, #1fb1b7)",
            color: "#0a0a0a",
          }}
        >
          {busy ? "Recovering..." : "Unlock with recovery key"}
        </button>

        <button
          onClick={() => {
            setError("");
            setPassphrase("");
            setStatus("locked");
          }}
          className="text-xs transition-colors hover:underline"
          style={{ color: "#777" }}
        >
          Back to passphrase
        </button>
      </div>
    );
  }

  // ── Unlocked: show all secrets ──
  return (
    <div className="px-4 py-4 space-y-4" style={{ background: "#0e0e0e", fontFamily: "'Manrope', sans-serif" }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">🔐 Vault</h2>
          <p className="text-xs" style={{ color: "#777" }}>
            {decryptedSecrets.length} secret {decryptedSecrets.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <button
          onClick={() => {
            setStatus("locked");
            setPassphrase("");
            setRecoveryInput("");
            setRevealedIds(new Set());
            onVaultUnlock(null);
          }}
          className="rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors hover:bg-white/5"
          style={{ color: "#aaa", borderColor: "rgba(72,72,71,0.3)" }}
        >
          🔒 Lock
        </button>
      </div>

      {copyMsg && (
        <div
          className="rounded-xl px-3 py-2 text-xs text-center font-medium"
          style={{ color: "#72eff5", background: "rgba(114,239,245,0.1)" }}
        >
          {copyMsg}
        </div>
      )}

      {decryptedSecrets.length === 0 ? (
        <div className="flex flex-col items-center py-16 space-y-2">
          <div className="text-4xl">🔐</div>
          <p className="text-sm text-white">No secrets yet</p>
          <p className="text-xs" style={{ color: "#777" }}>
            Capture a password, credit card, or PIN and it'll appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {decryptedSecrets.map((e) => {
            const revealed = revealedIds.has(e.id);
            const meta = Object.entries(e.metadata || {}).filter(
              ([k]) => k !== "category" && k !== "status",
            );
            return (
              <div
                key={e.id}
                className="rounded-2xl border overflow-hidden"
                style={{ background: "rgba(38,38,38,0.6)", borderColor: "rgba(72,72,71,0.2)" }}
              >
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{TC.secret.i}</span>
                    <span className="text-sm font-medium text-white truncate">{e.title}</span>
                  </div>
                  <button
                    onClick={() => toggleReveal(e.id)}
                    className="rounded-xl px-3 py-1 text-xs font-medium border shrink-0 transition-colors hover:bg-white/5"
                    style={{ color: "#72eff5", borderColor: "rgba(114,239,245,0.2)" }}
                  >
                    {revealed ? "Hide" : "Reveal"}
                  </button>
                </div>

                {revealed ? (
                  <div className="px-3 pb-3 space-y-3">
                    <div
                      className="rounded-xl p-3 border"
                      style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(72,72,71,0.15)" }}
                    >
                      <p className="text-sm font-mono text-white break-all">{e.content}</p>
                    </div>
                    {meta.length > 0 && (
                      <div className="space-y-1.5">
                        {meta.map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 text-xs">
                            <span className="shrink-0" style={{ color: "#777" }}>
                              {k.replace(/_/g, " ")}:
                            </span>
                            <span className="text-white truncate">{String(v)}</span>
                            <button
                              onClick={() => copyToClipboard(String(v), `${k} copied`)}
                              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                            >
                              📋
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: "rgba(72,72,71,0.2)" }}>
                      <button
                        onClick={() => copyToClipboard(e.content || "", "Content copied")}
                        className="rounded-xl px-3 py-1 text-xs border transition-colors hover:bg-white/5"
                        style={{ color: "#aaa", borderColor: "rgba(72,72,71,0.3)" }}
                      >
                        📋 Copy content
                      </button>
                      <button
                        onClick={() => onSelect(e)}
                        className="rounded-xl px-3 py-1 text-xs border transition-colors hover:bg-white/5"
                        style={{ color: "#aaa", borderColor: "rgba(72,72,71,0.3)" }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <span className="text-sm tracking-widest" style={{ color: "#555" }}>
                      ••••••••••••
                    </span>
                    {(e.tags?.length ?? 0) > 0 &&
                      e.tags!.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="rounded-full px-2 py-0.5 text-[10px]"
                          style={{ color: "#777", background: "rgba(72,72,71,0.3)" }}
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
