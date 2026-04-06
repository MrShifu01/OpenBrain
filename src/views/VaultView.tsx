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
      <div className="px-5 py-[60px] text-center">
        <div className="mb-3 text-[32px]">🔐</div>
        <p className="text-ob-text-dim text-[13px]">Checking vault...</p>
      </div>
    );
  }

  // ── Setup: passphrase creation ──
  if (status === "setup") {
    return (
      <div className="mx-auto max-w-[400px] p-5">
        <div className="mb-6 text-center">
          <div className="mb-3 text-[40px]">🔐</div>
          <h2 className="text-ob-text m-0 text-lg font-extrabold">Set up your Vault</h2>
          <p className="text-ob-text-dim mt-2 mb-0 text-[13px] leading-[1.6]">
            Choose a passphrase to protect your passwords, credit cards, and sensitive data.
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <div>
            <label className="text-ob-text-muted mb-1.5 block text-[11px] tracking-[1px] uppercase">
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
              className="bg-ob-bg border-ob-border text-ob-text-soft box-border w-full rounded-xl border p-3.5 font-[inherit] text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-ob-text-muted mb-1.5 block text-[11px] tracking-[1px] uppercase">
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
              className="bg-ob-bg border-ob-border text-ob-text-soft box-border w-full rounded-xl border p-3.5 font-[inherit] text-sm outline-none"
            />
          </div>
        </div>

        {error && <p className="m-0 mb-3 text-center text-xs text-[#FF6B35]">{error}</p>}

        <button
          onClick={handleSetup}
          disabled={busy || passphrase.length < 8}
          className={`min-h-11 w-full cursor-pointer rounded-xl border-none bg-gradient-to-br from-[#FF4757] to-[#FF6B81] p-3.5 text-sm font-bold text-white ${busy || passphrase.length < 8 ? "opacity-50" : ""}`}
        >
          {busy ? "Setting up..." : "Create Vault"}
        </button>
      </div>
    );
  }

  // ── Show recovery key (after setup, before unlocked) ──
  if (status === "show-recovery") {
    return (
      <div className="mx-auto max-w-[440px] p-5">
        <div className="mb-5 text-center">
          <div className="mb-3 text-[40px]">🗝</div>
          <h2 className="text-ob-text m-0 text-lg font-extrabold">Your Recovery Key</h2>
          <p className="text-ob-text-dim mt-2 mb-0 text-[13px] leading-[1.6]">
            If you ever forget your passphrase, this key is the{" "}
            <strong className="text-[#FF4757]">only way</strong> to recover your secrets. Write it
            down and store it somewhere safe.
          </p>
        </div>

        {/* Recovery key display */}
        <div className="bg-ob-bg mb-4 rounded-[14px] border-2 border-[#FF4757] p-5 text-center">
          <p className="m-0 font-mono text-[22px] leading-[1.6] font-extrabold tracking-[3px] break-all text-[#FF4757]">
            {generatedRecoveryKey}
          </p>
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(generatedRecoveryKey);
            setRecoveryCopied(true);
          }}
          className={`mb-3 min-h-11 w-full cursor-pointer rounded-[10px] border p-3 text-[13px] font-bold ${recoveryCopied ? "bg-teal/[0.12] border-teal/25 text-teal" : "border-[#FF4757]/25 bg-[#FF4757]/[0.12] text-[#FF4757]"}`}
        >
          {recoveryCopied ? "Copied!" : "📋 Copy recovery key"}
        </button>

        <div className="mb-4 rounded-xl border border-[#FF4757]/[0.19] bg-[#FF4757]/[0.06] px-4 py-3.5">
          <p className="m-0 text-[11px] leading-[1.6] text-[#FF6B81]">
            <strong>Write this down now.</strong> This key will not be shown again. Without your
            passphrase or this recovery key, encrypted entries are permanently lost.
          </p>
        </div>

        <button
          onClick={() => {
            setGeneratedRecoveryKey("");
            setStatus("unlocked");
          }}
          className="min-h-11 w-full cursor-pointer rounded-xl border-none bg-gradient-to-br from-[#FF4757] to-[#FF6B81] p-3.5 text-sm font-bold text-white"
        >
          I've saved my recovery key
        </button>
      </div>
    );
  }

  // ── Locked: passphrase entry ──
  if (status === "locked") {
    return (
      <div className="mx-auto max-w-[400px] p-5">
        <div className="mb-6 text-center">
          <div className="mb-3 text-[40px]">🔒</div>
          <h2 className="text-ob-text m-0 text-lg font-extrabold">Unlock Vault</h2>
          <p className="text-ob-text-dim mt-2 mb-0 text-[13px]">
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
          className="bg-ob-bg border-ob-border text-ob-text-soft mb-3 box-border w-full rounded-xl border p-3.5 font-[inherit] text-sm outline-none"
        />

        {error && <p className="m-0 mb-3 text-center text-xs text-[#FF6B35]">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={busy || !passphrase.trim()}
          className={`min-h-11 w-full cursor-pointer rounded-xl border-none bg-gradient-to-br from-[#FF4757] to-[#FF6B81] p-3.5 text-sm font-bold text-white ${busy || !passphrase.trim() ? "opacity-50" : ""}`}
        >
          {busy ? "Unlocking..." : "Unlock"}
        </button>

        <button
          onClick={() => {
            setError("");
            setRecoveryInput("");
            setStatus("recovery");
          }}
          className="text-ob-text-dim mt-3 w-full cursor-pointer border-none bg-transparent p-2.5 text-xs underline"
        >
          Forgot passphrase? Use recovery key
        </button>

        {secrets.length > 0 && (
          <p className="text-ob-text-dim mt-3 text-center text-xs">
            {secrets.length} encrypted {secrets.length === 1 ? "entry" : "entries"} waiting
          </p>
        )}
      </div>
    );
  }

  // ── Recovery: enter recovery key ──
  if (status === "recovery") {
    return (
      <div className="mx-auto max-w-[400px] p-5">
        <div className="mb-6 text-center">
          <div className="mb-3 text-[40px]">🗝</div>
          <h2 className="text-ob-text m-0 text-lg font-extrabold">Recovery Key</h2>
          <p className="text-ob-text-dim mt-2 mb-0 text-[13px] leading-[1.6]">
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
          className="bg-ob-bg border-ob-border text-ob-text-soft mb-3 box-border w-full rounded-xl border p-3.5 text-center font-[inherit] font-mono text-base tracking-[2px] outline-none"
        />

        {error && <p className="m-0 mb-3 text-center text-xs text-[#FF6B35]">{error}</p>}

        <button
          onClick={handleRecoveryUnlock}
          disabled={busy || !recoveryInput.trim()}
          className={`min-h-11 w-full cursor-pointer rounded-xl border-none bg-gradient-to-br from-[#FF4757] to-[#FF6B81] p-3.5 text-sm font-bold text-white ${busy || !recoveryInput.trim() ? "opacity-50" : ""}`}
        >
          {busy ? "Recovering..." : "Unlock with recovery key"}
        </button>

        <button
          onClick={() => {
            setError("");
            setPassphrase("");
            setStatus("locked");
          }}
          className="text-ob-text-dim mt-3 w-full cursor-pointer border-none bg-transparent p-2.5 text-xs underline"
        >
          Back to passphrase
        </button>
      </div>
    );
  }

  // ── Unlocked: show all secrets ──
  return (
    <div className="p-0">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-ob-text m-0 text-base font-extrabold">🔐 Vault</h2>
          <p className="text-ob-text-dim mt-1 mb-0 text-xs">
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
          className="cursor-pointer rounded-lg border border-[#FF4757]/25 bg-[#FF4757]/[0.12] px-3.5 py-1.5 text-xs font-semibold text-[#FF4757]"
        >
          🔒 Lock
        </button>
      </div>

      {copyMsg && (
        <div className="bg-teal text-ob-bg fixed top-5 left-1/2 z-[9000] -translate-x-1/2 rounded-[20px] px-5 py-2 text-[13px] font-bold">
          {copyMsg}
        </div>
      )}

      {decryptedSecrets.length === 0 ? (
        <div className="bg-ob-surface border-ob-border rounded-[14px] border px-5 py-10 text-center">
          <div className="mb-3 text-[32px]">🔐</div>
          <p className="text-ob-text-dim m-0 text-sm">No secrets yet</p>
          <p className="text-ob-text-faint mt-1.5 text-xs">
            Capture a password, credit card, or PIN and it'll appear here
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {decryptedSecrets.map((e) => {
            const revealed = revealedIds.has(e.id);
            const meta = Object.entries(e.metadata || {}).filter(
              ([k]) => k !== "category" && k !== "status",
            );
            return (
              <div
                key={e.id}
                className="bg-ob-surface overflow-hidden rounded-[14px] border border-[#FF4757]/[0.19] p-4"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TC.secret.i}</span>
                    <span className="text-ob-text text-sm font-bold">{e.title}</span>
                  </div>
                  <button
                    onClick={() => toggleReveal(e.id)}
                    className={`min-h-8 cursor-pointer rounded-lg border px-3 py-1 text-[11px] font-semibold ${revealed ? "border-[#FF4757]/25 bg-[#FF4757]/[0.12] text-[#FF4757]" : "bg-ob-surface2 border-ob-border text-ob-text-dim"}`}
                  >
                    {revealed ? "Hide" : "Reveal"}
                  </button>
                </div>

                {revealed ? (
                  <div>
                    <div className="mb-2 rounded-lg border border-[#FF4757]/[0.12] bg-[#FF4757]/[0.06] p-3">
                      <p className="text-ob-text-mid m-0 font-mono text-[13px] leading-[1.6] break-all whitespace-pre-wrap">
                        {e.content}
                      </p>
                    </div>
                    {meta.length > 0 && (
                      <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
                        {meta.map(([k, v]) => (
                          <div key={k} className="flex items-center gap-1 text-xs">
                            <span className="text-ob-text-muted capitalize">
                              {k.replace(/_/g, " ")}:
                            </span>
                            <span className="text-ob-text-mid font-mono">{String(v)}</span>
                            <button
                              onClick={() => copyToClipboard(String(v), `${k} copied`)}
                              className="text-ob-text-dim cursor-pointer border-none bg-transparent px-1 py-0.5 text-[11px]"
                            >
                              📋
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(e.content || "", "Content copied")}
                        className="min-h-9 cursor-pointer rounded-lg border border-[#FF4757]/25 bg-[#FF4757]/[0.12] px-3.5 py-2 text-xs font-semibold text-[#FF4757]"
                      >
                        📋 Copy content
                      </button>
                      <button
                        onClick={() => onSelect(e)}
                        className="bg-ob-surface2 border-ob-border text-ob-text-dim min-h-9 cursor-pointer rounded-lg border px-3.5 py-2 text-xs font-semibold"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-ob-text-dim text-[13px] tracking-[3px]">
                      ••••••••••••
                    </span>
                    {(e.tags?.length ?? 0) > 0 &&
                      e.tags!.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="rounded-[20px] bg-[#FF4757]/[0.06] px-2 py-0.5 text-[10px] text-[#FF4757]"
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
