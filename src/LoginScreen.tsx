import { useState, type JSX } from "react";
import { supabase } from "./lib/supabase";

interface Feature {
  ic: string;
  label: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    ic: "🧠",
    label: "Personal brain",
    desc: "Identity, health, finances, documents — always findable",
  },
  {
    ic: "🏠",
    label: "Family brain",
    desc: "Household info, kids' schools, emergency contacts — shared with the people that matter",
  },
  {
    ic: "🏪",
    label: "Business brain",
    desc: "Suppliers, staff, SOPs, licences — your whole operation in one place",
  },
  {
    ic: "✨",
    label: "AI that thinks for you",
    desc: "Classify, connect, remind, surface — not just store",
  },
];

export default function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  // OTP code entry
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
    if (error) setError(error.message);
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
    // If successful, onAuthStateChange in App.jsx will pick up the session
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
    else setError(null);
    setLoading(false);
  };

  const isDisabled = loading || !email;
  const isOtpDisabled = verifying || otpCode.length < 6 || otpCode.length > 8;

  return (
    <div className="bg-ob-bg text-ob-text min-h-screen font-['Söhne',system-ui,-apple-system,sans-serif]">
      {/* Hero */}
      <div className="mx-auto max-w-[540px] px-6 pt-[60px] text-center">
        <div className="mb-3 text-[52px]">🧠</div>
        <h1 className="text-ob-text m-0 mb-3 text-4xl leading-tight font-black tracking-tight">
          OpenBrain
        </h1>
        <p className="text-teal m-0 mb-2 text-lg font-semibold">
          Your second brain — for you, your family, your business.
        </p>
        <p className="text-ob-text-dim m-0 mb-8 text-sm leading-relaxed">
          Capture everything. Connect the dots. Ask anything.
          <br />
          One AI-powered memory OS that grows with your life.
        </p>

        {/* CTA */}
        {!showForm && !sent && (
          <button
            onClick={() => setShowForm(true)}
            className="gradient-accent mb-2.5 cursor-pointer rounded-[14px] border-none px-9 py-3.5 text-base font-extrabold text-[#0f0f23] shadow-[0_4px_24px_rgba(78,205,196,0.25)]"
          >
            Start free →
          </button>
        )}
        {!showForm && !sent && (
          <p className="text-ob-text-faint m-0 text-xs">No password needed — sign in with email</p>
        )}

        {/* Email form */}
        {showForm && !sent && (
          <form onSubmit={handleSend} className="mx-auto max-w-[360px]">
            <input
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
              className="bg-ob-surface border-ob-border text-ob-text mb-2.5 box-border w-full rounded-xl border px-4 py-[13px] text-[15px] outline-none"
            />
            {error && <p className="text-orange mb-2.5 text-[13px]">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-ob-surface border-ob-border text-ob-text-muted flex-1 cursor-pointer rounded-[10px] border p-3 text-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isDisabled}
                className={`flex-[2] rounded-[10px] border-none p-3 text-sm font-bold ${
                  isDisabled
                    ? "bg-ob-surface text-ob-text-faint cursor-default"
                    : "gradient-accent cursor-pointer text-[#0f0f23]"
                }`}
              >
                {loading ? "Sending…" : "Send code"}
              </button>
            </div>
            <p className="text-ob-text-faint mt-2 text-xs">We'll email you a code to sign in</p>
          </form>
        )}

        {/* OTP verification */}
        {sent && (
          <div className="mx-auto max-w-[360px]">
            <div className="mb-3 text-[32px]">📬</div>
            <p className="text-teal mb-1 text-base font-bold">Check your email</p>
            <p className="text-ob-text-muted m-0 mb-4 text-[13px] leading-relaxed">
              We sent a sign-in email to <strong className="text-ob-text">{email}</strong>.<br />
              Enter the code from the email, or tap the magic link.
            </p>

            <form onSubmit={handleVerifyOtp}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setOtpCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="Enter code"
                autoFocus
                className="bg-ob-surface border-ob-border text-ob-text mb-2.5 box-border w-full rounded-xl border px-4 py-[13px] text-center font-mono text-2xl font-bold tracking-[8px] outline-none"
              />
              {error && <p className="text-orange mb-2.5 text-[13px]">{error}</p>}
              <button
                type="submit"
                disabled={isOtpDisabled}
                className={`mb-3 w-full rounded-[10px] border-none p-3 text-sm font-bold ${
                  isOtpDisabled
                    ? "bg-ob-surface text-ob-text-faint cursor-default"
                    : "gradient-accent cursor-pointer text-[#0f0f23]"
                }`}
              >
                {verifying ? "Verifying…" : "Sign in with code"}
              </button>
            </form>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleResend}
                disabled={loading}
                className="text-teal cursor-pointer border-none bg-transparent px-2 py-1 text-[13px]"
              >
                {loading ? "Sending…" : "Resend code"}
              </button>
              <button
                onClick={() => {
                  setSent(false);
                  setOtpCode("");
                  setError(null);
                }}
                className="text-ob-text-faint cursor-pointer border-none bg-transparent px-2 py-1 text-[13px]"
              >
                Use different email
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature grid */}
      <div className="mx-auto mt-12 max-w-[540px] px-6 pb-[60px]">
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="bg-ob-surface border-ob-border rounded-[14px] border px-4 py-[18px]"
            >
              <div className="mb-2 text-2xl">{f.ic}</div>
              <div className="text-ob-text mb-1 text-[13px] font-bold">{f.label}</div>
              <div className="text-ob-text-dim text-xs leading-normal">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="bg-ob-surface border-ob-border mt-8 rounded-[14px] border px-6 py-5 text-center">
          <p className="text-ob-text-dim m-0 text-[13px] leading-relaxed">
            <strong className="text-ob-text-muted">Your data is yours.</strong> Export everything,
            delete everything. No lock-in.
            <br />
            Built on Supabase + Claude AI.
          </p>
        </div>
      </div>
    </div>
  );
}
