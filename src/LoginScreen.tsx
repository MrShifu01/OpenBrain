import { useState, type JSX } from "react";
import { supabase } from "./lib/supabase";
import { Brain, RefreshCw } from "lucide-react";

interface Feature {
  emoji: string;
  label: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    emoji: "🧠",
    label: "Personal brain",
    desc: "Identity, health, finances, documents — always findable",
  },
  {
    emoji: "👨‍👩‍👧",
    label: "Family brain",
    desc: "Household info, kids' schools, emergency contacts — shared with the people that matter",
  },
  {
    emoji: "🏢",
    label: "Business brain",
    desc: "Suppliers, staff, SOPs, licences — your whole operation in one place",
  },
];

function toFriendlyError(msg: string): string {
  if (msg.toLowerCase().includes("database error saving new user")) {
    return "Account setup failed. Please try again in a moment.";
  }
  return msg;
}

export default function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(toFriendlyError(error.message));
    else setSent(true);
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setVerifying(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: "magiclink",
    });
    if (error) setError(error.message);
    setVerifying(false);
  };

  const handleResend = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setOtpCode("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const isDisabled = loading || !email;
  const isOtpDisabled = verifying || otpCode.length < 6 || otpCode.length > 8;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "var(--color-background)",
        color: "var(--color-on-surface)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* ── DESKTOP: two-column layout ── */}
      <div
        className="login-two-col"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "stretch",
          minHeight: "100vh",
        }}
      >
        {/* LEFT PANEL — branding + features */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "clamp(40px, 6vw, 80px) clamp(32px, 5vw, 72px)",
            borderRight: "1px solid var(--color-outline-variant)",
          }}
        >
          {/* Logo + Brand */}
          <div style={{ marginBottom: 48 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-primary-container)",
                border: "1px solid var(--color-outline-variant)",
                marginBottom: 24,
              }}
              aria-hidden="true"
            >
              <Brain size={24} style={{ color: "var(--color-primary)" }} />
            </div>

            <h1
              style={{
                fontFamily: "'Lora', Georgia, serif",
                fontSize: "clamp(2rem, 3.5vw, 3rem)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: "0 0 12px",
                lineHeight: 1.1,
                color: "var(--color-on-surface)",
              }}
            >
              Everion
            </h1>

            <p style={{ fontSize: 16, fontWeight: 500, color: "var(--color-primary)", margin: "0 0 8px" }}>
              Your second brain — for you, your family, your business.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-on-surface-variant)", margin: 0, maxWidth: 440 }}>
              Capture everything. Connect the dots. Ask anything.
              One AI-powered memory system that grows with your life.
            </p>
          </div>

          {/* Feature list — hidden on mobile */}
          <div
            className="login-feature-list"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: 480,
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="login-feature-item"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <span
                  style={{ fontSize: 18, lineHeight: 1, marginTop: 2, flexShrink: 0 }}
                  aria-hidden="true"
                >
                  {f.emoji}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-on-surface)", marginBottom: 2 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-on-surface-variant)" }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy note — hidden on mobile */}
          <p className="login-privacy-note" style={{ marginTop: 32, fontSize: 12, color: "var(--color-on-surface-variant)", maxWidth: 440, opacity: 0.7 }}>
            Your data is yours. Export everything, delete everything. No lock-in.
          </p>
        </div>

        {/* RIGHT PANEL — login form */}
        <div
          style={{
            width: "clamp(340px, 40vw, 500px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(40px, 5vw, 64px) clamp(32px, 4vw, 56px)",
          }}
        >
          <div style={{ width: "100%", maxWidth: 360 }}>

            {/* ── CTA (pre-form) ── */}
            {!showForm && !sent && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2
                  style={{
                    fontFamily: "'Lora', Georgia, serif",
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    margin: "0 0 4px",
                    color: "var(--color-on-surface)",
                  }}
                >
                  Welcome to Everion
                </h2>
                <p style={{ fontSize: 14, color: "var(--color-on-surface-variant)", margin: "0 0 8px" }}>
                  No password needed — just your email.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="login-primary-btn"
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 10,
                    border: "none",
                    background: "var(--color-primary)",
                    color: "var(--color-on-primary)",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "background 150ms",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  Start free
                </button>
              </div>
            )}

            {/* ── Email form ── */}
            {showForm && !sent && (
              <>
                <h2
                  style={{
                    fontFamily: "'Lora', Georgia, serif",
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    margin: "0 0 6px",
                    color: "var(--color-on-surface)",
                  }}
                >
                  Sign in
                </h2>
                <p style={{ fontSize: 13, color: "var(--color-on-surface-variant)", margin: "0 0 20px" }}>
                  Enter your email and we'll send an access code.
                </p>
                <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label
                      htmlFor="login-email"
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--color-on-surface-variant)",
                        marginBottom: 6,
                      }}
                    >
                      Email address
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="neural@email.com"
                      required
                      autoFocus
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        border: "1px solid var(--color-outline-variant)",
                        background: "var(--color-surface-container)",
                        color: "var(--color-on-surface)",
                        fontSize: 15,
                        padding: "11px 14px",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        transition: "border-color 150ms",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; }}
                    />
                  </div>

                  {error && <p role="alert" style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{error}</p>}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 8,
                        border: "1px solid var(--color-outline-variant)",
                        background: "transparent",
                        color: "var(--color-on-surface-variant)",
                        fontSize: 14,
                        cursor: "pointer",
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        transition: "color 150ms",
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isDisabled}
                      style={{
                        flex: 2,
                        height: 44,
                        borderRadius: 8,
                        border: "none",
                        background: isDisabled
                          ? "var(--color-surface-container-highest)"
                          : "var(--color-primary)",
                        color: isDisabled
                          ? "var(--color-on-surface-variant)"
                          : "var(--color-on-primary)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isDisabled ? "default" : "pointer",
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        transition: "background 150ms",
                        opacity: isDisabled ? 0.6 : 1,
                      }}
                    >
                      {loading ? "Sending…" : "Send access code"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ── OTP verification ── */}
            {sent && (
              <div>
                <h2
                  style={{
                    fontFamily: "'Lora', Georgia, serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--color-on-surface)",
                    margin: "0 0 8px",
                  }}
                >
                  Check your email
                </h2>
                <p style={{ fontSize: 13, color: "var(--color-on-surface-variant)", lineHeight: 1.6, margin: "0 0 8px" }}>
                  Sent to <strong style={{ color: "var(--color-on-surface)" }}>{email}</strong>.
                </p>
                <p style={{ fontSize: 13, color: "var(--color-on-surface-variant)", lineHeight: 1.6, margin: "0 0 24px" }}>
                  Enter the code or tap the sign-in link.
                </p>

                <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label
                      htmlFor="otp-code"
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--color-on-surface-variant)",
                        marginBottom: 6,
                      }}
                    >
                      6-digit code
                    </label>
                    <input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="000000"
                      autoFocus
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        border: "1px solid var(--color-outline-variant)",
                        background: "var(--color-surface-container)",
                        color: "var(--color-on-surface)",
                        fontSize: 28,
                        fontWeight: 700,
                        padding: "12px 14px",
                        outline: "none",
                        textAlign: "center",
                        letterSpacing: 8,
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        fontVariantNumeric: "tabular-nums",
                        boxSizing: "border-box",
                        transition: "border-color 150ms",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; }}
                    />
                  </div>

                  {error && <p role="alert" style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{error}</p>}

                  <button
                    type="submit"
                    disabled={isOtpDisabled}
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 8,
                      border: "none",
                      background: isOtpDisabled
                        ? "var(--color-surface-container-highest)"
                        : "var(--color-primary)",
                      color: isOtpDisabled
                        ? "var(--color-on-surface-variant)"
                        : "var(--color-on-primary)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isOtpDisabled ? "default" : "pointer",
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      transition: "background 150ms",
                      opacity: isOtpDisabled ? 0.6 : 1,
                    }}
                  >
                    {verifying ? "Signing in…" : "Sign in"}
                  </button>
                </form>

                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-primary)",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: "10px 12px",
                    }}
                  >
                    {loading ? "Sending…" : "Resend code"}
                  </button>
                  <button
                    onClick={() => { setSent(false); setOtpCode(""); setError(null); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-on-surface-variant)",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: "10px 12px",
                    }}
                  >
                    Use different email
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                  <RefreshCw size={14} style={{ color: "var(--color-on-surface-variant)", opacity: 0.6 }} aria-hidden="true" />
                  <p style={{ fontSize: 12, color: "var(--color-on-surface-variant)", margin: 0, opacity: 0.7 }}>
                    Link expires in 60 minutes.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`
        .login-primary-btn:hover {
          background: var(--color-primary-dim) !important;
        }
        @media (max-width: 768px) {
          .login-two-col {
            flex-direction: column !important;
            min-height: auto !important;
          }
          /* Form panel first on mobile — instant clarity */
          .login-two-col > div:last-child {
            order: -1;
            width: 100% !important;
            padding: 36px 24px !important;
          }
          .login-two-col > div:first-child {
            border-right: none !important;
            border-bottom: 1px solid var(--color-outline-variant) !important;
            padding: 32px 24px !important;
          }
          /* Hide feature list on mobile — just show brand headline */
          .login-feature-list { display: none !important; }
          .login-privacy-note { display: none !important; }
        }
      `}</style>
    </div>
  );
}
