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

  // Group by category
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

  const brainEmoji = brainType === "business" ? "🏪" : brainType === "family" ? "🏠" : "🧠";

  return (
    <div className="bg-ob-surface border-ob-border mb-4 overflow-hidden rounded-2xl border">
      {/* Compact header — always visible */}
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
      >
        <span className="text-sm">{brainEmoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-ob-text m-0 text-[13px] font-semibold">
            {questions.length} things to capture
          </p>
          <p className="text-ob-text-dim m-0 text-[11px]">
            {categories
              .slice(0, 3)
              .map(([cat]) => cat)
              .join(" · ")}
            {categories.length > 3 && ` +${categories.length - 3}`}
          </p>
        </div>
        <span className="text-ob-text-dim shrink-0 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded: show categories as compact rows */}
      {expanded && (
        <div className="border-ob-border border-t py-1.5">
          {categories.map(([cat, items]) => (
            <div
              key={cat}
              onClick={() => onNavigate("suggest")}
              className="flex cursor-pointer items-center gap-2 px-3.5 py-2"
            >
              <span className="text-ob-text-dim flex-1 text-[11px] font-medium">
                {cat} <span className="text-ob-text-faint">({items.length})</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissCategory(cat);
                }}
                className="text-ob-text-faint cursor-pointer border-none bg-transparent px-1 py-0.5 text-[13px] leading-none"
              >
                ×
              </button>
            </div>
          ))}

          <div className="border-ob-border mt-1 flex gap-2 border-t px-3.5 py-2 pb-2.5">
            <button
              onClick={() => onNavigate("suggest")}
              className="bg-teal/10 border-teal/25 text-teal flex-1 cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold"
            >
              Fill Brain →
            </button>
            <button
              onClick={dismissAll}
              className="border-ob-border text-ob-text-faint cursor-pointer rounded-lg border bg-transparent px-3 py-2 text-xs"
            >
              Dismiss all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
