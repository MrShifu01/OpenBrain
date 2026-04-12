import { useMemo } from "react";
import { TC } from "../data/constants";
import { loadGraph } from "../lib/conceptGraph";
import { findSurprisingConnections } from "../lib/surpriseScore";
import type { Entry } from "../types";
import type { SurprisingConnection } from "../lib/surpriseScore";

interface SurprisingConnectionsProps {
  entries: Entry[];
  brainId?: string;
  onSelect?: (entry: Entry) => void;
}

const CONFIDENCE_DOT: Record<string, string> = {
  extracted: "rgb(22,163,74)",
  inferred: "rgb(217,119,6)",
};

export default function SurprisingConnections({
  entries,
  brainId,
  onSelect,
}: SurprisingConnectionsProps) {
  const surprises = useMemo<SurprisingConnection[]>(() => {
    if (!brainId) return [];
    const graph = loadGraph(brainId);
    if (graph.concepts.length === 0) return [];
    return findSurprisingConnections(graph, entries, 5);
  }, [brainId, entries]);

  if (surprises.length === 0) return null;

  return (
    <div className="space-y-3">
      <p
        className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: "var(--color-on-surface-variant)" }}
      >
        Surprising Connections ({surprises.length})
      </p>
      {surprises.map((s, i) => (
        <div
          key={i}
          className="space-y-2 rounded-2xl p-4"
          style={{
            background: "var(--color-surface-container)",
            border: "1px solid var(--color-outline-variant)",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelect?.(s.entryA)}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
              <span className="text-sm">
                {(TC as Record<string, any>)[s.entryA.type]?.i || "📝"}
              </span>
              <span
                className="truncate text-xs font-medium"
                style={{ color: "var(--color-on-surface)" }}
              >
                {s.entryA.title}
              </span>
            </button>
            <span
              className="flex-shrink-0 text-xs"
              style={{ color: "var(--color-primary)" }}
            >
              ⟷
            </span>
            <button
              onClick={() => onSelect?.(s.entryB)}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-right"
            >
              <span
                className="truncate text-xs font-medium"
                style={{ color: "var(--color-on-surface)" }}
              >
                {s.entryB.title}
              </span>
              <span className="text-sm">
                {(TC as Record<string, any>)[s.entryB.type]?.i || "📝"}
              </span>
            </button>
          </div>
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            {s.why}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: CONFIDENCE_DOT[s.confidence] || CONFIDENCE_DOT.inferred }}
            />
            <span
              className="text-[10px] capitalize"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              {s.confidence}
            </span>
            <div className="flex flex-1 flex-wrap justify-end gap-1">
              {s.sharedConcepts.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                  style={{
                    background: "var(--color-secondary-container)",
                    color: "var(--color-secondary)",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
