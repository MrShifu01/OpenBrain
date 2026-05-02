// PIN entry screen — second-and-onwards vault unlock when PIN is configured.
// Offers biometric as a one-tap alternative when enrolled. Both fall back
// to the master passphrase via the "use passphrase instead" link.

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";

const PIN_LENGTH = 6;

export function VaultPinScreen({
  busy,
  error,
  biometricEnrolled,
  onSubmit,
  onBiometric,
  onUsePassphrase,
}: {
  busy: boolean;
  error: string;
  biometricEnrolled: boolean;
  onSubmit: (pin: string) => void;
  onBiometric: () => void;
  onUsePassphrase: () => void;
}) {
  const [pin, setPin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const submit = () => {
    if (pin.length < 4 || busy) return;
    onSubmit(pin);
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (digits.length === PIN_LENGTH) {
      // Auto-submit on full length for nicer mobile UX.
      setTimeout(() => onSubmit(digits), 50);
    }
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "18px 32px",
          borderBottom: "1px solid var(--line-soft)",
          minHeight: 72,
        }}
      >
        <div>
          <h1
            className="f-serif"
            style={{
              fontSize: 28,
              fontWeight: 450,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Vault
          </h1>
          <div
            className="f-serif"
            style={{ fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 4 }}
          >
            quick unlock.
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
        }}
      >
        <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
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
              marginBottom: 20,
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
              fontSize: 32,
              fontWeight: 400,
              color: "var(--ink)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            enter your PIN.
          </h2>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              margin: "28px 0 12px",
            }}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: i < pin.length ? "var(--ember)" : "transparent",
                  border: "2px solid var(--line-soft)",
                  borderColor: i < pin.length ? "var(--ember)" : "var(--line-soft)",
                }}
              />
            ))}
          </div>

          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="\d*"
            value={pin}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="off"
            className="design-input"
            aria-label="PIN"
            style={{
              height: 48,
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
              style={{ fontSize: 14, fontStyle: "italic", color: "var(--blood)", marginTop: 10 }}
            >
              {error}
            </p>
          )}

          <Button
            onClick={submit}
            disabled={busy || pin.length < 4}
            size="lg"
            className="mt-4 w-full"
          >
            {busy ? "unlocking…" : "Unlock"}
          </Button>

          {biometricEnrolled && (
            <Button
              variant="outline"
              size="lg"
              className="mt-2 w-full"
              onClick={onBiometric}
              disabled={busy}
            >
              👆 use biometric
            </Button>
          )}

          <Button
            variant="link"
            size="sm"
            onClick={onUsePassphrase}
            className="mt-3 italic"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--f-serif)" }}
          >
            forgot PIN? use passphrase.
          </Button>
        </div>
      </div>
    </div>
  );
}
