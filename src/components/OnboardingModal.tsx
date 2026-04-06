import { useState } from "react";
import PropTypes from "prop-types";

/* ─── 30 essential starter questions ─── */
export const ONBOARDING_QUESTIONS = [
  {
    q: "What is your full legal name, ID/SSN number, date of birth, and document issue date?",
    cat: "👤 Identity",
    p: "high",
  },
  {
    q: "What is your passport number, country of issue, issue date, and expiry date?",
    cat: "👤 Identity",
    p: "high",
  },
  {
    q: "What is your driver's licence number, category/class, issue date, and expiry date?",
    cat: "👤 Identity",
    p: "high",
  },
  { q: "What is your blood type?", cat: "🏥 Health", p: "high" },
  {
    q: "Do you have any allergies — medications, foods, insect stings, latex, or environmental?",
    cat: "🏥 Health",
    p: "high",
  },
  {
    q: "Who are your emergency contacts? List 2–3 people with name, relationship, and phone number.",
    cat: "🚨 Emergency",
    p: "high",
  },
  {
    q: "Who is your health insurance provider? Include your policy/member number and emergency contact number.",
    cat: "📋 Medical Aid",
    p: "high",
  },
  {
    q: "Who is your GP or primary care physician? Name, practice, and phone number.",
    cat: "🏥 Health",
    p: "high",
  },
  {
    q: "Do you take any chronic medication? List each medication, dosage, frequency, and what it's for.",
    cat: "🏥 Health",
    p: "high",
  },
  {
    q: "Who is your legal next of kin? Full name, relationship, phone number, and address.",
    cat: "🚨 Emergency",
    p: "high",
  },
  {
    q: "What is your full residential address including postal/zip code?",
    cat: "👤 Identity",
    p: "high",
  },
  {
    q: "What vehicle do you drive? Make, model, year, colour, registration plate, and VIN.",
    cat: "🚗 Vehicle",
    p: "high",
  },
  {
    q: "Who is your vehicle insurance provider? Policy number and claims contact number.",
    cat: "🚗 Vehicle",
    p: "high",
  },
  {
    q: "Do you have roadside assistance? Provider, membership number, and emergency call-out number.",
    cat: "🚗 Vehicle",
    p: "medium",
  },
  {
    q: "What bank holds your primary account? Include branch/routing code and the bank's fraud line.",
    cat: "💰 Finance",
    p: "high",
  },
  {
    q: "What is your tax identification number? Include the relevant tax authority and your filing frequency.",
    cat: "💰 Finance",
    p: "high",
  },
  {
    q: "Who handles your taxes? Name, firm, phone number, and email.",
    cat: "💰 Finance",
    p: "medium",
  },
  {
    q: "Do you have a lawyer? Name, firm, speciality, phone number, and email.",
    cat: "⚖️ Legal",
    p: "medium",
  },
  {
    q: "Do you have a will? Where is the original stored, who is the executor, and when was it last updated?",
    cat: "⚖️ Legal",
    p: "medium",
  },
  {
    q: "Do you have home or renters insurance? Provider, policy number, and what's covered?",
    cat: "🏠 Home",
    p: "high",
  },
  {
    q: "What phone and laptop do you use? For each: brand, model, serial number, purchase date, and warranty expiry.",
    cat: "💻 Devices",
    p: "high",
  },
  {
    q: "Who is your internet service provider? Account number and monthly cost. Same for electricity, water, and gas.",
    cat: "🏠 Home",
    p: "medium",
  },
  {
    q: "Do you have a home alarm? Provider, account number, armed response number, and a hint for your alarm code.",
    cat: "🏠 Home",
    p: "medium",
  },
  {
    q: "Where do you keep your critical physical documents — birth certificate, property deeds, certificates, policies?",
    cat: "📄 Documents",
    p: "high",
  },
  {
    q: "What are your employer or business details? Company name, employee/registration number, and address.",
    cat: "💼 Work",
    p: "medium",
  },
  {
    q: "Do you have children or dependants? Names, dates of birth, ID numbers, schools, and medical details.",
    cat: "👨‍👩‍👧 Family",
    p: "medium",
  },
  {
    q: "Do you have pets? Name, breed, microchip number, vet name and number, and vaccination schedule.",
    cat: "🐾 Pets",
    p: "low",
  },
  {
    q: "List the key birthdays and anniversaries you must never forget — partner, parents, children, close friends.",
    cat: "📅 Dates",
    p: "medium",
  },
  {
    q: "Where are your spare keys stored — house, car, office? Does anyone else hold a copy?",
    cat: "🏠 Home",
    p: "medium",
  },
  {
    q: "List your active subscriptions and monthly costs: streaming, gym, cloud storage, insurance premiums, software.",
    cat: "💰 Finance",
    p: "low",
  },
];

const ALL_STEPS = [
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
    subtitle: "Start by capturing your first memory or answering guided questions in Fill Brain.",
  },
];

function needsIOSStep() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.MSStream &&
    (!("Notification" in window) || !window.navigator.standalone)
  );
}

const USE_CASES = [
  {
    id: "personal",
    emoji: "🧠",
    label: "Personal",
    desc: "Identity, health, finances, contacts, documents",
  },
  {
    id: "family",
    emoji: "🏠",
    label: "Family",
    desc: "Household, kids, shared finances, emergencies",
  },
  {
    id: "business",
    emoji: "🏪",
    label: "Business",
    desc: "Staff, suppliers, SOPs, licences, costs",
  },
];

export default function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(["personal"]);

  const STEPS = ALL_STEPS;
  const START_STEP = STEPS.length - 1;

  // Starter questions state — kept for backward compat with onComplete signature
  const [answeredItems] = useState([]); // [{q, a, cat}]
  const [skippedQs] = useState(() =>
    ONBOARDING_QUESTIONS.map((q) => ({ q: q.q, cat: q.cat, p: q.p })),
  );

  function toggleUseCase(id) {
    setSelected((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id],
    );
  }

  function handleComplete() {
    try {
      localStorage.setItem("openbrain_onboarded", "1");
    } catch {}
    onComplete(selected, answeredItems, skippedQs);
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center overflow-y-auto bg-black/85 p-5">
      <div className="bg-ob-surface2 border-ob-border m-auto box-border w-full max-w-[440px] rounded-[18px] border px-4 py-6 shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
        {/* Progress dots */}
        <div
          className="mb-7 flex justify-center gap-1.5"
          role="tablist"
          aria-label="Onboarding progress"
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              aria-label={`Step ${i + 1} of ${STEPS.length}`}
              role="tab"
              aria-selected={i === step}
              className={`h-2 rounded transition-all duration-300 ${
                i === step ? "bg-teal w-5" : i < step ? "bg-teal/50 w-2" : "bg-ob-surface w-2"
              }`}
            />
          ))}
        </div>

        <div className="mb-6 text-center">
          <div className="mb-2.5 text-4xl">{step === START_STEP ? "🚀" : "🧠"}</div>
          <h2 className="text-ob-text m-0 text-xl font-extrabold">{STEPS[step].title}</h2>
          <p className="text-ob-text-dim mt-2 mb-0 text-[13px]">{STEPS[step].subtitle}</p>
        </div>

        {/* Step 0 — Use case selection */}
        {step === 0 && (
          <div className="mb-6 flex flex-col gap-2.5">
            {USE_CASES.map((uc) => {
              const active = selected.includes(uc.id);
              return (
                <button
                  key={uc.id}
                  onClick={() => toggleUseCase(uc.id)}
                  role="checkbox"
                  aria-checked={active}
                  className={`flex cursor-pointer items-center gap-3.5 rounded-xl px-4 py-3.5 text-left ${
                    active
                      ? "bg-teal/[0.08] border-teal/[0.37] border"
                      : "bg-ob-surface border-ob-border border"
                  }`}
                >
                  <span className="text-2xl">{uc.emoji}</span>
                  <div className="flex-1">
                    <div className={`text-sm font-bold ${active ? "text-teal" : "text-ob-text"}`}>
                      {uc.label}
                    </div>
                    <div className="text-ob-text-dim mt-0.5 text-xs">{uc.desc}</div>
                  </div>
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                      active
                        ? "bg-teal border-none text-[#0f0f23]"
                        : "border-ob-border border-2 bg-transparent"
                    }`}
                  >
                    {active && "✓"}
                  </div>
                </button>
              );
            })}
            <p className="text-ob-text-faint mt-1 mb-0 text-center text-[11px]">
              Select all that apply
            </p>
          </div>
        )}

        {/* Step 1 — Setup summary */}
        {step === 1 && (
          <div className="mb-6">
            {selected.map((id) => {
              const uc = USE_CASES.find((u) => u.id === id);
              return (
                <div
                  key={id}
                  className="bg-teal/[0.08] border-teal/[0.19] mb-2 flex items-center gap-3 rounded-[10px] border px-4 py-3"
                >
                  <span className="text-xl">{uc.emoji}</span>
                  <div>
                    <div className="text-ob-text text-[13px] font-semibold">{uc.label} brain</div>
                    <div className="text-ob-text-dim text-[11px]">
                      {id === "personal" &&
                        "Fill Brain will show personal questions (identity, health, finance…)"}
                      {id === "family" && "Your family brain is ready for household & family data"}
                      {id === "business" &&
                        "Your business brain will show supplier, staff & SOP questions"}
                    </div>
                  </div>
                  <span className="text-teal ml-auto text-base">✓</span>
                </div>
              );
            })}
            <div className="bg-ob-surface border-ob-border mt-3.5 rounded-[10px] border px-4 py-3">
              <p className="text-ob-text-dim m-0 text-xs leading-normal">
                💡 <strong className="text-ob-text-muted">Tip:</strong> Use the brain switcher
                (top-right) to switch between brains at any time. You can always create more brains
                later.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Ready to go */}
        {step === START_STEP && (
          <div className="mb-6">
            <div className="bg-teal/[0.08] border-teal/[0.19] mb-4 rounded-[10px] border px-4 py-3">
              <p className="text-ob-text-dim m-0 text-xs leading-normal">
                <strong className="text-teal">{skippedQs.length} guided questions</strong> are
                waiting in Fill Brain to help you build your memory.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                {
                  ic: "\u2726",
                  label: "Fill Brain",
                  desc: "Answer guided questions to build your memory",
                },
                { ic: "+", label: "Quick Capture", desc: "Type anything — AI will structure it" },
                {
                  ic: "\u25C7",
                  label: "Refine",
                  desc: "AI audits entries and finds missing connections",
                },
                { ic: "\u25C8", label: "Ask", desc: "Chat with AI about everything you've stored" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="bg-ob-surface border-ob-border flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5"
                >
                  <span className="text-teal w-6 shrink-0 text-center text-base">{f.ic}</span>
                  <div>
                    <div className="text-ob-text text-[13px] font-semibold">{f.label}</div>
                    <div className="text-ob-text-dim text-[11px]">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {needsIOSStep() && (
              <div className="bg-ob-surface border-ob-border mt-3.5 rounded-[10px] border px-4 py-3">
                <p className="text-ob-text-dim m-0 text-xs leading-normal">
                  📱 <strong className="text-ob-text-muted">iPhone tip:</strong> Tap Share → "Add to
                  Home Screen" to enable push notifications.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className={`flex gap-2.5 ${step === 0 ? "justify-end" : "justify-between"}`}>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="bg-ob-surface border-ob-border text-ob-text-muted cursor-pointer rounded-xl border px-7 py-3 text-sm font-bold"
            >
              ← Back
            </button>
          )}
          {step === 0 && (
            <button
              onClick={() => setStep(1)}
              className="gradient-accent cursor-pointer rounded-xl border-none px-7 py-3 text-sm font-bold text-[#0f0f23]"
            >
              Set up my brain →
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => setStep(START_STEP)}
              className="gradient-accent cursor-pointer rounded-xl border-none px-7 py-3 text-sm font-bold text-[#0f0f23]"
            >
              Let's go →
            </button>
          )}
          {step === START_STEP && (
            <button
              onClick={handleComplete}
              className="gradient-accent cursor-pointer rounded-xl border-none px-7 py-3 text-sm font-bold text-[#0f0f23]"
            >
              Start capturing →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

OnboardingModal.propTypes = {
  onComplete: PropTypes.func.isRequired,
};
