import { useState, useMemo, type JSX } from "react";
import { SUGGESTIONS } from "../data/personalSuggestions";
import { FAMILY_SUGGESTIONS } from "../data/familySuggestions";
import { BUSINESS_SUGGESTIONS } from "../data/businessSuggestions";
import type { Brain, Suggestion } from "../types";

const DISMISSED_KEY = "openbrain_checklist_dismissed";
const ANSWERED_KEY = "openbrain_answered_qs";

function getSuggestions(type: string): Suggestion[] {
  if (type === "family") return FAMILY_SUGGESTIONS;
  if (type === "business") return BUSINESS_SUGGESTIONS;
  return SUGGESTIONS;
}

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

function getAnswered(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(ANSWERED_KEY) || "[]"));
  } catch {
    return new Set<string>();
  }
}

interface OnboardingChecklistProps {
  activeBrain: Brain | null;
  onNavigate: (view: string) => void;
}

export default function OnboardingChecklist({
  activeBrain,
  onNavigate,
}: OnboardingChecklistProps): JSX.Element | null {
  const [dismissed, setDismissed] = useState<string[]>(getDismissed);
  const [expanded, setExpanded] = useState<boolean>(false);

  const brainType = activeBrain?.type || "personal";
  const answered = useMemo(() => getAnswered(), []);

  const questions = useMemo(() => {
    const all = getSuggestions(brainType);
    return all.filter((s) => s.p === "high" && !answered.has(s.q) && !dismissed.includes(s.q));
  }, [brainType, answered, dismissed]);

  const categories = useMemo((): [string, Suggestion[]][] => {
    const cats: Record<string, Suggestion[]> = {};
    questions.forEach((q) => {
      if (!cats[q.cat]) cats[q.cat] = [];
      cats[q.cat].push(q);
    });
    return (Object.entries(cats) as [string, Suggestion[]][]).sort(
      (a, b) => b[1].length - a[1].length,
    );
  }, [questions]);

  if (questions.length === 0) return null;

  function dismissAll(): void {
    const next = [...dismissed, ...questions.map((s) => s.q)];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {}
  }

  function dismissCategory(cat: string): void {
    const catQs = questions.filter((q) => q.cat === cat).map((q) => q.q);
    const next = [...dismissed, ...catQs];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {}
  }

  return (
    <div>
      {/* Header — always visible */}
      <button onClick={() => setExpanded((e) => !e)}>
        <div>
          <span>✦</span>
        </div>
        <div>
          <p>{questions.length} things to capture</p>
          <p>
            {categories.slice(0, 3).map(([cat]) => cat).join(" · ")}
            {categories.length > 3 && ` +${categories.length - 3}`}
          </p>
        </div>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded categories */}
      {expanded && (
        <div>
          {categories.map(([cat, items]) => (
            <div
              key={cat}
              onClick={() => onNavigate("suggest")}
            >
              <span>
                {cat} <span>({items.length})</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissCategory(cat);
                }}
              >
                ×
              </button>
            </div>
          ))}

          <div>
            <button onClick={() => onNavigate("suggest")}>
              Fill Brain →
            </button>
            <button onClick={dismissAll}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
