// App-level lock — wraps the entire app shell behind a PIN/biometric
// gate when the user has opted in via Settings. Reuses the same PIN
// and WebAuthn credential as the vault (no second PIN to remember).
//
// Lock triggers: page load (if app-lock enabled) AND idle timeout.
// Unlock: same PIN OR biometric. No passphrase fallback at this level —
// the user can dismiss app-lock from the screen and continue with the
// vault still locked. (App-lock is privacy on shared devices, not a
// crypto barrier — the vault remains the security boundary.)
//
// Sub-project 4 of 5 in EML "Vault — beyond V3 narrow scope".

import { useState } from "react";
import { Button } from "./ui/button";
import { isAppLockEnabled, getAppLockTimeoutMinutes } from "../lib/appLockSettings";
import {
  loadPinRecord,
  loadBiometricRecord,
  unwrapVaultKeyWithPin,
  unwrapVaultKeyWithBiometricMaterial,
} from "../lib/vaultPinKey";
import { assertBiometric } from "../lib/biometric";
import { useAppLockTimer } from "../hooks/useAppLockTimer";
import { isFeatureEnabled, getAdminFlags } from "../lib/featureFlags";

const PIN_LENGTH = 6;

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const flagOn = isFeatureEnabled("appLock", getAdminFlags());
  const userOptedIn = isAppLockEnabled();
  const hasPinOrBio = !!loadPinRecord() || !!loadBiometricRecord();
  const enabled = flagOn && userOptedIn && hasPinOrBio;

  // Start locked if the gate is enabled. (User wants the lock to engage
  // on every page load, not only after idle.)
  const [locked, setLocked] = useState(enabled);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useAppLockTimer({
    enabled: enabled && !locked,
    timeoutMinutes: getAppLockTimeoutMinutes(),
    onIdle: () => setLocked(true),
  });

  // No effect needed for "user disabled the gate while mounted" — the
  // render guard `!enabled || !locked` already returns children. If they
  // re-enable later, the latched `locked=true` correctly re-engages the
  // gate (which is what "I want to re-lock my app" means).

  if (!enabled || !locked) return <>{children}</>;

  const tryPin = async (entered: string) => {
    const rec = loadPinRecord();
    if (!rec) {
      setError("No PIN configured.");
      return;
    }
    setBusy(true);
    setError("");
    const key = await unwrapVaultKeyWithPin(rec, entered);
    if (!key) {
      setError("Wrong PIN.");
      setBusy(false);
      return;
    }
    setLocked(false);
    setPin("");
    setBusy(false);
  };

  const tryBiometric = async () => {
    const bio = loadBiometricRecord();
    if (!bio) {
      setError("No biometric configured.");
      return;
    }
    setBusy(true);
    setError("");
    const assertion = await assertBiometric(bio.credential_id_b64);
    if (!assertion?.prfOutput) {
      setError("Biometric failed — try PIN.");
      setBusy(false);
      return;
    }
    const key = await unwrapVaultKeyWithBiometricMaterial(bio, assertion.prfOutput);
    if (!key) {
      setError("Biometric failed — wrong credential?");
      setBusy(false);
      return;
    }
    setLocked(false);
    setBusy(false);
  };

  const onPinChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (digits.length === PIN_LENGTH) {
      setTimeout(() => tryPin(digits), 50);
    }
  };

  return (
    <>
      {/* Render the app underneath but make it inert (so screen-readers
          don't surface it; touch events captured by the overlay). */}
      <div aria-hidden="true" style={{ filter: "blur(8px)", pointerEvents: "none" }}>
        {children}
      </div>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20, 16, 12, 0.92)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          zIndex: 9999,
          backdropFilter: "blur(4px)",
        }}
      >
        <div
          style={{
            maxWidth: 360,
            width: "100%",
            textAlign: "center",
            background: "var(--bg)",
            border: "1px solid var(--line-soft)",
            borderRadius: 16,
            padding: "32px 24px",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--ember-wash)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <svg
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              style={{ color: "var(--ember)" }}
            >
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <h2
            className="f-serif"
            style={{
              fontSize: 26,
              fontWeight: 400,
              color: "var(--ink)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            locked.
          </h2>
          <p
            className="f-serif"
            style={{
              fontSize: 14,
              color: "var(--ink-soft)",
              fontStyle: "italic",
              margin: "8px 0 22px",
            }}
          >
            enter your PIN to continue.
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              margin: "10px 0",
            }}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: i < pin.length ? "var(--ember)" : "transparent",
                  border: "2px solid",
                  borderColor: i < pin.length ? "var(--ember)" : "var(--line-soft)",
                }}
              />
            ))}
          </div>

          <input
            type="password"
            inputMode="numeric"
            pattern="\d*"
            value={pin}
            onChange={(e) => onPinChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryPin(pin)}
            autoFocus
            autoComplete="off"
            aria-label="PIN"
            className="design-input"
            style={{
              height: 44,
              fontSize: 18,
              textAlign: "center",
              letterSpacing: "0.4em",
              fontFamily: "var(--f-mono)",
              opacity: 0.01,
              position: "absolute",
              left: -9999,
            }}
          />

          {error && (
            <p
              className="f-serif"
              style={{ fontSize: 13, fontStyle: "italic", color: "var(--blood)", marginTop: 10 }}
            >
              {error}
            </p>
          )}

          <Button
            onClick={() => tryPin(pin)}
            disabled={busy || pin.length < 4}
            size="lg"
            className="mt-3 w-full"
          >
            {busy ? "checking…" : "Unlock"}
          </Button>

          {!!loadBiometricRecord() && (
            <Button
              variant="outline"
              size="lg"
              className="mt-2 w-full"
              onClick={tryBiometric}
              disabled={busy}
            >
              👆 use biometric
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
