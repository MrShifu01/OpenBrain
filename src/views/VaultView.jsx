import { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { useTheme } from "../ThemeContext";
import { TC } from "../data/constants";
import { authFetch } from "../lib/authFetch";
import { setupVault, unlockVault, decryptEntry } from "../lib/crypto";

/* ─── States: "loading" → "setup" | "locked" | "unlocked" ─── */

export default function VaultView({ entries, onSelect, cryptoKey, onVaultUnlock }) {
  const { t } = useTheme();
  const [status, setStatus] = useState("loading"); // loading | setup | locked | unlocked
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [vaultData, setVaultData] = useState(null); // { salt, verify_token }
  const [decryptedSecrets, setDecryptedSecrets] = useState([]);
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [copyMsg, setCopyMsg] = useState(null);
  const inputRef = useRef(null);

  const secrets = entries.filter(e => e.type === "secret");

  // Check vault status on mount
  useEffect(() => {
    if (cryptoKey) {
      setStatus("unlocked");
      return;
    }
    authFetch("/api/vault")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setStatus("setup"); return; }
        if (data.exists) { setVaultData(data); setStatus("locked"); }
        else setStatus("setup");
      })
      .catch(() => setStatus("setup"));
  }, [cryptoKey]);

  // Decrypt secrets when unlocked
  useEffect(() => {
    if (status !== "unlocked" || !cryptoKey || secrets.length === 0) {
      setDecryptedSecrets([]);
      return;
    }
    Promise.all(secrets.map(e => decryptEntry(e, cryptoKey)))
      .then(setDecryptedSecrets)
      .catch(() => setDecryptedSecrets(secrets));
  }, [status, cryptoKey, secrets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === "setup" || status === "locked") {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [status]);

  // ── Setup: create new vault ──
  const handleSetup = useCallback(async () => {
    if (passphrase.length < 8) { setError("Passphrase must be at least 8 characters"); return; }
    if (passphrase !== confirm) { setError("Passphrases don't match"); return; }
    setBusy(true);
    setError("");
    try {
      const { key, salt, verifyToken } = await setupVault(passphrase);
      const res = await authFetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salt, verify_token: verifyToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      onVaultUnlock(key);
      setStatus("unlocked");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }, [passphrase, confirm, onVaultUnlock]);

  // ── Unlock: derive key from passphrase ──
  const handleUnlock = useCallback(async () => {
    if (!passphrase.trim()) return;
    setBusy(true);
    setError("");
    try {
      const key = await unlockVault(passphrase, vaultData.salt, vaultData.verify_token);
      if (!key) { setError("Wrong passphrase"); setBusy(false); return; }
      onVaultUnlock(key);
      setStatus("unlocked");
    } catch {
      setError("Decryption failed");
    }
    setBusy(false);
  }, [passphrase, vaultData, onVaultUnlock]);

  const toggleReveal = (id) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg(label || "Copied");
      setTimeout(() => setCopyMsg(null), 2000);
    });
  };

  const inp = { width: "100%", padding: "14px", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, color: t.textSoft, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const accentBtn = { width: "100%", padding: "14px", background: "linear-gradient(135deg, #FF4757, #FF6B81)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 44 };

  // ── Loading ──
  if (status === "loading") {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
        <p style={{ color: t.textDim, fontSize: 13 }}>Checking vault...</p>
      </div>
    );
  }

  // ── Setup: first-time passphrase creation ──
  if (status === "setup") {
    return (
      <div style={{ padding: "20px", maxWidth: 400, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Set up your Vault</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: t.textDim, lineHeight: 1.6 }}>
            Choose a passphrase to protect your passwords, credit cards, and sensitive data.
            This passphrase is your <strong style={{ color: "#FF4757" }}>only way</strong> to recover secrets on a new device.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Passphrase</label>
            <input
              ref={inputRef}
              type="password"
              value={passphrase}
              onChange={e => { setPassphrase(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && inputRef.current?.nextElementSibling?.nextElementSibling?.querySelector?.("input")?.focus()}
              placeholder="At least 8 characters"
              style={inp}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Confirm passphrase</label>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleSetup()}
              placeholder="Enter again to confirm"
              style={inp}
            />
          </div>
        </div>

        {error && <p style={{ color: "#FF6B35", fontSize: 12, margin: "0 0 12px", textAlign: "center" }}>{error}</p>}

        <button onClick={handleSetup} disabled={busy || passphrase.length < 8} style={{ ...accentBtn, opacity: busy || passphrase.length < 8 ? 0.5 : 1 }}>
          {busy ? "Setting up..." : "Create Vault"}
        </button>

        <div style={{ marginTop: 20, padding: "14px 16px", background: "#FF475710", border: "1px solid #FF475730", borderRadius: 12 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#FF6B81", lineHeight: 1.6 }}>
            <strong>Important:</strong> There is no "forgot passphrase" option. If you lose this passphrase, your encrypted entries cannot be recovered. Write it down somewhere safe.
          </p>
        </div>
      </div>
    );
  }

  // ── Locked: passphrase entry ──
  if (status === "locked") {
    return (
      <div style={{ padding: "20px", maxWidth: 400, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Unlock Vault</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: t.textDim }}>
            Enter your vault passphrase to view secrets
          </p>
        </div>

        <input
          ref={inputRef}
          type="password"
          value={passphrase}
          onChange={e => { setPassphrase(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleUnlock()}
          placeholder="Vault passphrase"
          style={{ ...inp, marginBottom: 12 }}
        />

        {error && <p style={{ color: "#FF6B35", fontSize: 12, margin: "0 0 12px", textAlign: "center" }}>{error}</p>}

        <button onClick={handleUnlock} disabled={busy || !passphrase.trim()} style={{ ...accentBtn, opacity: busy || !passphrase.trim() ? 0.5 : 1 }}>
          {busy ? "Unlocking..." : "Unlock"}
        </button>

        {secrets.length > 0 && (
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: t.textDim }}>
            {secrets.length} encrypted {secrets.length === 1 ? "entry" : "entries"} waiting
          </p>
        )}
      </div>
    );
  }

  // ── Unlocked: show all secrets ──
  return (
    <div style={{ padding: "0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text }}>
            🔐 Vault
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: t.textDim }}>
            {decryptedSecrets.length} secret {decryptedSecrets.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        <button
          onClick={() => { setStatus("locked"); setPassphrase(""); setRevealedIds(new Set()); onVaultUnlock(null); }}
          style={{ padding: "6px 14px", background: "#FF475720", border: "1px solid #FF475740", borderRadius: 8, color: "#FF4757", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >🔒 Lock</button>
      </div>

      {copyMsg && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#4ECDC4", color: "#0f0f23", padding: "8px 20px", borderRadius: 20, fontSize: 13, fontWeight: 700, zIndex: 9000 }}>
          {copyMsg}
        </div>
      )}

      {decryptedSecrets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
          <p style={{ color: t.textDim, fontSize: 14, margin: 0 }}>No secrets yet</p>
          <p style={{ color: t.textFaint, fontSize: 12, marginTop: 6 }}>
            Capture a password, credit card, or PIN and it'll appear here
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {decryptedSecrets.map(e => {
            const revealed = revealedIds.has(e.id);
            const meta = Object.entries(e.metadata || {}).filter(([k]) => k !== "category" && k !== "status");
            return (
              <div key={e.id} style={{ background: t.surface, border: `1px solid #FF475730`, borderRadius: 14, padding: "16px", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{TC.secret.i}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{e.title}</span>
                  </div>
                  <button
                    onClick={() => toggleReveal(e.id)}
                    style={{ padding: "4px 12px", background: revealed ? "#FF475720" : t.surface2 || "#1a1a2e", border: `1px solid ${revealed ? "#FF475740" : t.border}`, borderRadius: 8, color: revealed ? "#FF4757" : t.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer", minHeight: 32 }}
                  >{revealed ? "Hide" : "Reveal"}</button>
                </div>

                {/* Content */}
                {revealed ? (
                  <div>
                    <div style={{ background: "#FF475710", border: "1px solid #FF475720", borderRadius: 8, padding: "12px", marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, color: t.textMid, fontFamily: "monospace", lineHeight: 1.6, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{e.content}</p>
                    </div>
                    {meta.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: 10 }}>
                        {meta.map(([k, v]) => (
                          <div key={k} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ color: t.textMuted, textTransform: "capitalize" }}>{k.replace(/_/g, " ")}:</span>
                            <span style={{ color: t.textMid, fontFamily: "monospace" }}>{String(v)}</span>
                            <button onClick={() => copyToClipboard(String(v), `${k} copied`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: t.textDim, padding: "2px 4px" }}>📋</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => copyToClipboard(e.content, "Content copied")} style={{ padding: "8px 14px", background: "#FF475720", border: "1px solid #FF475740", borderRadius: 8, color: "#FF4757", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 36 }}>📋 Copy content</button>
                      <button onClick={() => onSelect(e)} style={{ padding: "8px 14px", background: t.surface2 || "#1a1a2e", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 36 }}>Edit</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: t.textDim, letterSpacing: 3 }}>••••••••••••</span>
                    {e.tags?.length > 0 && e.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{ fontSize: 10, color: "#FF4757", background: "#FF475710", padding: "2px 8px", borderRadius: 20 }}>{tag}</span>
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

VaultView.propTypes = {
  entries: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
  cryptoKey: PropTypes.object,
  onVaultUnlock: PropTypes.func.isRequired,
};
