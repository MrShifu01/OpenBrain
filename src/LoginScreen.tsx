import { useState, type JSX } from "react";
import { supabase } from "./lib/supabase";
import { Brain, Cpu, Network, Shield, ArrowRight, RefreshCw } from "lucide-react";

interface Feature {
  Icon: React.ElementType;
  color: string;
  label: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    Icon: Brain,
    color: "#72eff5",
    label: "Personal brain",
    desc: "Identity, health, finances, documents — always findable",
  },
  {
    Icon: Network,
    color: "#8b5cf6",
    label: "Family brain",
    desc: "Household info, kids' schools, emergency contacts — shared with the people that matter",
  },
  {
    Icon: Cpu,
    color: "#ff9ac3",
    label: "Business brain",
    desc: "Suppliers, staff, SOPs, licences — your whole operation in one place",
  },
  {
    Icon: Shield,
    color: "#72eff5",
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
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "#0e0e0e", color: "#ffffff", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Atmospheric background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(114,239,245,0.08) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(139,92,246,0.08) 0%, transparent 45%)",
        }}
      />

      {/* Hero section */}
      <div className="relative z-10 mx-auto max-w-[540px] px-6 pt-16 pb-4 text-center">

        {/* Synapse Logo */}
        <div className="relative mb-8 inline-flex items-center justify-center">
          <div
            className="absolute -inset-8 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(114,239,245,0.12) 0%, rgba(139,92,246,0.08) 50%, transparent 70%)" }}
          />
          <div
            className="relative flex h-28 w-28 items-center justify-center rounded-full border"
            style={{
              background: "rgba(38,38,38,0.6)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderColor: "rgba(114,239,245,0.2)",
              boxShadow: "0 0 40px rgba(114,239,245,0.08)",
            }}
          >
            <Brain size={52} style={{ color: "#72eff5", filter: "drop-shadow(0 0 12px rgba(114,239,245,0.5))" }} />
            {/* Orbital rings */}
            <div
              className="absolute inset-0 rounded-full border animate-pulse"
              style={{ borderColor: "rgba(114,239,245,0.15)", transform: "scale(1.15)" }}
            />
            <div
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: "rgba(139,92,246,0.08)", transform: "scale(1.30)" }}
            />
          </div>
        </div>

        {/* Brand headline */}
        <h1
          className="mb-3 text-5xl font-black tracking-tight"
          style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: "-0.03em" }}
        >
          Open
          <span
            style={{
              background: "linear-gradient(135deg, #72eff5, #8b5cf6, #ff9ac3)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Brain
          </span>
        </h1>

        <p className="mb-2 text-base font-semibold" style={{ color: "#72eff5" }}>
          Your second brain — for you, your family, your business.
        </p>
        <p className="mb-8 text-sm leading-relaxed" style={{ color: "#777575" }}>
          Capture everything. Connect the dots. Ask anything.
          <br />
          One AI-powered memory OS that grows with your life.
        </p>

        {/* ── CTA / Form states ── */}
        {!showForm && !sent && (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="group relative mb-3 inline-flex h-14 w-full max-w-xs cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-2xl border-none font-bold text-base transition-transform active:scale-95"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                color: "#ffffff",
                boxShadow: "0 0 30px rgba(139,92,246,0.25)",
              }}
            >
              {/* Shine */}
              <span
                className="absolute inset-0 translate-x-[-100%] transition-transform duration-700 group-hover:translate-x-[100%]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }}
              />
              <span className="relative flex items-center gap-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Start free
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
            <p className="text-xs" style={{ color: "#777575" }}>No password needed — sign in with email</p>
          </>
        )}

        {/* Email form */}
        {showForm && !sent && (
          <form onSubmit={handleSend} className="mx-auto max-w-[360px]">
            <div className="relative mb-3">
              <label className="mb-1.5 block text-left text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#adaaaa" }}>
                EMAIL NODE
              </label>
              <input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="neural@email.com"
                required
                autoFocus
                className="w-full rounded-xl border px-4 py-3.5 text-[15px] outline-none transition-all duration-200"
                style={{
                  background: "#262626",
                  borderColor: "rgba(72,72,71,0.3)",
                  color: "#ffffff",
                  fontFamily: "'Inter', sans-serif",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(114,239,245,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(114,239,245,0.2)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(72,72,71,0.3)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
            {error && <p className="mb-3 text-[13px]" style={{ color: "#ff6e84" }}>{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 cursor-pointer rounded-xl border p-3 text-sm transition-colors hover:opacity-80"
                style={{ background: "#1a1919", borderColor: "rgba(72,72,71,0.3)", color: "#adaaaa" }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isDisabled}
                className={`flex-[2] rounded-xl border-none p-3 text-sm font-bold transition-all ${
                  isDisabled ? "cursor-default opacity-40" : "cursor-pointer active:scale-95"
                }`}
                style={isDisabled
                  ? { background: "#262626", color: "#777575" }
                  : { background: "linear-gradient(135deg, #72eff5, #1fb1b7)", color: "#0a0a0a" }
                }
              >
                {loading ? "Sending…" : "Send access code"}
              </button>
            </div>
            <p className="mt-2 text-xs" style={{ color: "#777575" }}>We'll email you a code to sign in</p>
          </form>
        )}

        {/* OTP verification */}
        {sent && (
          <div className="mx-auto max-w-[360px]">
            <div
              className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl"
              style={{ background: "rgba(114,239,245,0.1)", border: "1px solid rgba(114,239,245,0.2)" }}
            >
              <RefreshCw size={28} style={{ color: "#72eff5" }} />
            </div>
            <p className="mb-1 text-base font-bold" style={{ color: "#72eff5" }}>Check your email</p>
            <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "#adaaaa" }}>
              We sent a sign-in code to{" "}
              <strong style={{ color: "#ffffff" }}>{email}</strong>.
              <br />
              Enter the code below, or tap the magic link.
            </p>
            <form onSubmit={handleVerifyOtp}>
              <label className="mb-1.5 block text-left text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#adaaaa" }}>
                ACCESS KEY
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setOtpCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="000000"
                autoFocus
                className="mb-3 w-full rounded-xl border px-4 py-3.5 text-center font-mono text-2xl font-bold tracking-[8px] outline-none transition-all"
                style={{
                  background: "#262626",
                  borderColor: "rgba(72,72,71,0.3)",
                  color: "#ffffff",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(114,239,245,0.6)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(72,72,71,0.3)"; }}
              />
              {error && <p className="mb-3 text-[13px]" style={{ color: "#ff6e84" }}>{error}</p>}
              <button
                type="submit"
                disabled={isOtpDisabled}
                className={`mb-4 w-full rounded-xl border-none p-3 text-sm font-bold transition-all ${
                  isOtpDisabled ? "cursor-default opacity-40" : "cursor-pointer active:scale-95"
                }`}
                style={isOtpDisabled
                  ? { background: "#262626", color: "#777575" }
                  : { background: "linear-gradient(135deg, #72eff5, #1fb1b7)", color: "#0a0a0a" }
                }
              >
                {verifying ? "Verifying…" : "Sync to Neural Network"}
              </button>
            </form>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleResend}
                disabled={loading}
                className="cursor-pointer border-none bg-transparent px-2 py-1 text-[13px] transition-opacity hover:opacity-70"
                style={{ color: "#72eff5" }}
              >
                {loading ? "Sending…" : "Resend code"}
              </button>
              <button
                onClick={() => { setSent(false); setOtpCode(""); setError(null); }}
                className="cursor-pointer border-none bg-transparent px-2 py-1 text-[13px] transition-opacity hover:opacity-70"
                style={{ color: "#777575" }}
              >
                Use different email
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature grid */}
      <div className="relative z-10 mx-auto mt-10 max-w-[540px] px-6 pb-16">
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="rounded-2xl border px-4 py-5 transition-all duration-300 hover:scale-[1.01]"
              style={{
                background: "rgba(38,38,38,0.6)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderColor: "rgba(72,72,71,0.15)",
              }}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}
              >
                <f.Icon size={20} style={{ color: f.color }} />
              </div>
              <div className="mb-1 text-[13px] font-bold" style={{ color: "#ffffff", fontFamily: "'Manrope', sans-serif" }}>
                {f.label}
              </div>
              <div className="text-xs leading-normal" style={{ color: "#777575" }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Privacy note */}
        <div
          className="mt-4 rounded-2xl border px-6 py-5 text-center"
          style={{
            background: "rgba(38,38,38,0.6)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: "rgba(72,72,71,0.15)",
          }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: "#777575" }}>
            <strong style={{ color: "#adaaaa" }}>Your data is yours.</strong> Export everything,
            delete everything. No lock-in.
            <br />
            Built on Supabase + Claude AI.
          </p>
        </div>
      </div>

      {/* Bottom atmospheric fill */}
      <div
        className="pointer-events-none fixed bottom-0 left-0 h-1/3 w-full"
        style={{ background: "linear-gradient(to top, rgba(139,92,246,0.04), transparent)", zIndex: 0 }}
      />
    </div>
  );
}
