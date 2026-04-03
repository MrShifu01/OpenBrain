import { useState } from "react";
import { useTheme } from "../ThemeContext";

const STEPS = [
  {
    id: "purpose",
    title: "What will you use OpenBrain for?",
    subtitle: "We'll set up the right brain for you.",
  },
  {
    id: "setup",
    title: "Here's what we've set up",
    subtitle: "Your brain is ready. You can add more later.",
  },
  {
    id: "start",
    title: "You're ready to go",
    subtitle: "Start by answering a few questions or capturing your first memory.",
  },
];

const USE_CASES = [
  { id: "personal", emoji: "🧠", label: "Personal", desc: "Identity, health, finances, contacts, documents" },
  { id: "family",   emoji: "🏠", label: "Family",   desc: "Household, kids, shared finances, emergencies" },
  { id: "business", emoji: "🏪", label: "Business",  desc: "Staff, suppliers, SOPs, licences, costs" },
];

export default function OnboardingModal({ onComplete }) {
  const { t } = useTheme();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(["personal"]);

  function toggleUseCase(id) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(x => x !== id) : prev // keep at least 1
        : [...prev, id]
    );
  }

  function handleComplete() {
    try { localStorage.setItem("openbrain_onboarded", "1"); } catch {}
    onComplete(selected);
  }

  const overlay = {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 3000, padding: 20,
  };

  const card = {
    background: t.surface2 || "#1a1a2e",
    border: `1px solid ${t.border}`,
    borderRadius: 18,
    padding: 32,
    maxWidth: 440,
    width: "100%",
    boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
  };

  const btn = (primary) => ({
    padding: "12px 28px",
    background: primary ? "linear-gradient(135deg, #4ECDC4, #45B7D1)" : t.surface,
    border: primary ? "none" : `1px solid ${t.border}`,
    borderRadius: 12,
    color: primary ? "#0f0f23" : t.textMuted,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? "#4ECDC4" : i < step ? "#4ECDC480" : t.surface, transition: "all 0.3s" }} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🧠</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text }}>{STEPS[step].title}</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: t.textDim }}>{STEPS[step].subtitle}</p>
        </div>

        {/* Step 0 — Use case selection */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {USE_CASES.map(uc => {
              const active = selected.includes(uc.id);
              return (
                <button
                  key={uc.id}
                  onClick={() => toggleUseCase(uc.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px",
                    background: active ? "#4ECDC415" : t.surface,
                    border: active ? "1px solid #4ECDC460" : `1px solid ${t.border}`,
                    borderRadius: 12, cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{uc.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#4ECDC4" : t.text }}>{uc.label}</div>
                    <div style={{ fontSize: 12, color: t.textDim, marginTop: 2 }}>{uc.desc}</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: active ? "none" : `2px solid ${t.border}`, background: active ? "#4ECDC4" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#0f0f23", flexShrink: 0 }}>
                    {active && "✓"}
                  </div>
                </button>
              );
            })}
            <p style={{ fontSize: 11, color: t.textFaint, textAlign: "center", margin: "4px 0 0" }}>Select all that apply</p>
          </div>
        )}

        {/* Step 1 — Setup summary */}
        {step === 1 && (
          <div style={{ marginBottom: 24 }}>
            {selected.map(id => {
              const uc = USE_CASES.find(u => u.id === id);
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#4ECDC415", border: "1px solid #4ECDC430", borderRadius: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{uc.emoji}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{uc.label} brain</div>
                    <div style={{ fontSize: 11, color: t.textDim }}>
                      {id === "personal" && "Fill Brain will show personal questions (identity, health, finance…)"}
                      {id === "family" && "Your family brain is ready for household & family data"}
                      {id === "business" && "Your business brain will show supplier, staff & SOP questions"}
                    </div>
                  </div>
                  <span style={{ marginLeft: "auto", color: "#4ECDC4", fontSize: 16 }}>✓</span>
                </div>
              );
            })}
            <div style={{ marginTop: 14, padding: "12px 16px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 12, color: t.textDim, lineHeight: 1.5 }}>
                💡 <strong style={{ color: t.textMuted }}>Tip:</strong> Use the brain switcher (top-right) to switch between brains at any time. You can always create more brains later.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Ready */}
        {step === 2 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { ic: "✦", label: "Fill Brain", desc: "Answer guided questions to build your memory" },
                { ic: "+", label: "Quick Capture", desc: "Type anything — AI will structure it" },
                { ic: "◇", label: "Refine", desc: "AI audits entries and finds missing connections" },
                { ic: "◈", label: "Ask", desc: "Chat with AI about everything you've stored" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10 }}>
                  <span style={{ fontSize: 16, color: "#4ECDC4", width: 24, textAlign: "center", flexShrink: 0 }}>{f.ic}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: t.textDim }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10, justifyContent: step === 0 ? "flex-end" : "space-between" }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={btn(false)}>← Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} style={btn(true)}>
              {step === 0 ? "Set up my brain →" : "Continue →"}
            </button>
          ) : (
            <button onClick={handleComplete} style={btn(true)}>Start capturing →</button>
          )}
        </div>
      </div>
    </div>
  );
}
