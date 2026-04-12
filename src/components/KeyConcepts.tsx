import { useMemo } from "react";
import { loadGraph, getGodNodes } from "../lib/conceptGraph";
import type { Concept } from "../types";

interface KeyConceptsProps {
  brainId?: string;
  onFilterByConcept?: (conceptLabel: string) => void;
}

export default function KeyConcepts({ brainId, onFilterByConcept }: KeyConceptsProps) {
  const godNodes = useMemo<Concept[]>(() => {
    if (!brainId) return [];
    const graph = loadGraph(brainId);
    return getGodNodes(graph, 8);
  }, [brainId]);

  if (godNodes.length === 0) return null;

  return (
    <div
      className="space-y-3 rounded-2xl p-4"
      style={{
        background: "var(--color-surface-container-low)",
        border: "1px solid var(--color-outline-variant)",
      }}
    >
      <p
        className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: "var(--color-on-surface-variant)" }}
      >
        Core Themes
      </p>
      <div className="flex flex-wrap gap-2">
        {godNodes.map((c) => (
          <button
            key={c.id}
            onClick={() => onFilterByConcept?.(c.label)}
            className="press-scale flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: "var(--color-secondary-container)",
              color: "var(--color-secondary)",
              border: "none",
              cursor: onFilterByConcept ? "pointer" : "default",
            }}
          >
            {c.label}
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px]"
              style={{
                background: "var(--color-surface-container)",
                color: "var(--color-on-surface-variant)",
              }}
            >
              {c.frequency}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
