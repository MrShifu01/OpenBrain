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
    <div>
      <div>
        {/* Progress dots */}
        <div role="tablist" aria-label="Onboarding progress">
          {STEPS.map((_, i) => (
            <div
              key={i}
              aria-label={`Step ${i + 1} of ${STEPS.length}`}
              role="tab"
              aria-selected={i === step}
            />
          ))}
        </div>

        <div>
          <div>{step === START_STEP ? "🚀" : "🧠"}</div>
          <h2>{STEPS[step].title}</h2>
          <p>{STEPS[step].subtitle}</p>
        </div>

        {/* Step 0 — Use case selection */}
        {step === 0 && (
          <div>
            {USE_CASES.map((uc) => {
              const active = selected.includes(uc.id);
              return (
                <button
                  key={uc.id}
                  onClick={() => toggleUseCase(uc.id)}
                  role="checkbox"
                  aria-checked={active}
                >
                  <span>{uc.emoji}</span>
                  <div>
                    <div>{uc.label}</div>
                    <div>{uc.desc}</div>
                  </div>
                  <div>
                    {active && "✓"}
                  </div>
                </button>
              );
            })}
            <p>Select all that apply</p>
          </div>
        )}

        {/* Step 1 — Setup summary */}
        {step === 1 && (
          <div>
            {selected.map((id) => {
              const uc = USE_CASES.find((u) => u.id === id);
              return (
                <div key={id}>
                  <span>{uc.emoji}</span>
                  <div>
                    <div>{uc.label} brain</div>
                    <div>
                      {id === "personal" &&
                        "Fill Brain will show personal questions (identity, health, finance…)"}
                      {id === "family" && "Your family brain is ready for household & family data"}
                      {id === "business" &&
                        "Your business brain will show supplier, staff & SOP questions"}
                    </div>
                  </div>
                  <span>✓</span>
                </div>
              );
            })}
            <div>
              <p>
                💡 <strong>Tip:</strong> Use the brain switcher
                (top-right) to switch between brains at any time. You can always create more brains
                later.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Ready to go */}
        {step === START_STEP && (
          <div>
            <div>
              <p>
                <strong>{skippedQs.length} guided questions</strong> are
                waiting in Fill Brain to help you build your memory.
              </p>
            </div>
            <div>
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
                <div key={f.label}>
                  <span>{f.ic}</span>
                  <div>
                    <div>{f.label}</div>
                    <div>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {needsIOSStep() && (
              <div>
                <p>
                  📱 <strong>iPhone tip:</strong> Tap Share → "Add to
                  Home Screen" to enable push notifications.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)}>
              ← Back
            </button>
          )}
          {step === 0 && (
            <button onClick={() => setStep(1)}>
              Set up my brain →
            </button>
          )}
          {step === 1 && (
            <button onClick={() => setStep(START_STEP)}>
              Let's go →
            </button>
          )}
          {step === START_STEP && (
            <button onClick={handleComplete}>
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
