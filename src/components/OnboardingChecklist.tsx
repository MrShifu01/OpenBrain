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
    <div className="bg-ob-surface border-ob-border mb-5 overflow-hidden rounded-2xl border">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full cursor-pointer items-center gap-3.5 border-none bg-transparent px-5 py-4 text-left"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal/10 text-sm">
          <span className="text-teal">✦</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ob-text m-0 text-[14px] font-semibold">
            {questions.length} things to capture
          </p>
          <p className="text-ob-text-dim m-0 mt-0.5 text-[12px]">
            {categories
              .slice(0, 3)
              .map(([cat]) => cat)
              .join(" · ")}
            {categories.length > 3 && ` +${categories.length - 3}`}
          </p>
        </div>
        <span className="text-ob-text-dim shrink-0 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded categories */}
      {expanded && (
        <div className="border-ob-border border-t px-2 py-2">
          {categories.map(([cat, items]) => (
            <div
              key={cat}
              onClick={() => onNavigate("suggest")}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-3 active:bg-ob-accent-light"
            >
              <span className="text-ob-text flex-1 text-[13px] font-medium">
                {cat} <span className="text-ob-text-dim">({items.length})</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissCategory(cat);
                }}
                className="touch-target text-ob-text-faint flex cursor-pointer items-center justify-center border-none bg-transparent text-base leading-none"
              >
                ×
              </button>
            </div>
          ))}

          <div className="border-ob-border mt-1 flex gap-2.5 border-t px-3 pt-3 pb-2">
            <button
              onClick={() => onNavigate("suggest")}
              className="gradient-accent flex-1 cursor-pointer rounded-xl border-none px-4 py-3 text-[13px] font-semibold text-white"
            >
              Fill Brain →
            </button>
            <button
              onClick={dismissAll}
              className="border-ob-border text-ob-text-dim cursor-pointer rounded-xl border bg-transparent px-4 py-3 text-[12px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
