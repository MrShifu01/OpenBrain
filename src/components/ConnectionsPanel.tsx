import { resolveIcon } from "../lib/typeIcons";
import type { Entry } from "../types";

interface RelatedLink {
  from: string;
  to: string;
  rel?: string;
  similarity?: number;
  other?: Entry;
  dir: string;
}

interface ConceptItem {
  id: string;
  label: string;
}

interface ConceptRelatedItem {
  entryId: string;
  entry?: Entry;
  sharedConcepts: string[];
}

interface ConnectionsPanelProps {
  related: RelatedLink[];
  entryConcepts: ConceptItem[];
  conceptRelated: ConceptRelatedItem[];
  typeIcons: Record<string, string>;
}

export function ConnectionsPanel({
  related,
  entryConcepts,
  conceptRelated,
  typeIcons,
}: ConnectionsPanelProps) {
  if (!related.length && !entryConcepts.length && !conceptRelated.length) return null;
  return (
    <>
      {related.length > 0 && (
        <div className="pt-1">
          <p
            className="mb-2 text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            Connections
          </p>
          {related.map(
            (r, i) =>
              r.other && (
                <div
                  key={i}
                  className="mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ background: "var(--color-surface-container)" }}
                >
                  <span>{resolveIcon(r.other.type, typeIcons)}</span>
                  <span className="text-on-surface-variant/50">{r.dir}</span>
                  <span className="text-on-surface flex-1">{r.other.title}</span>
                  <span className="text-on-surface-variant/50 text-[10px] tracking-widest uppercase">
                    {r.rel}
                  </span>
                </div>
              ),
          )}
        </div>
      )}
      {entryConcepts.length > 0 && (
        <div className="pt-1">
          <p
            className="mb-2 text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            Concepts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {entryConcepts.map((c) => (
              <span
                key={c.id}
                className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                style={{
                  background: "var(--color-secondary-container)",
                  color: "var(--color-secondary)",
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {conceptRelated.length > 0 && (
        <div className="pt-1">
          <p
            className="mb-2 text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            Related by Concepts
          </p>
          {conceptRelated.map((r) => (
            <div
              key={r.entryId}
              className="mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--color-surface-container)" }}
            >
              <span>{resolveIcon(r.entry!.type, typeIcons)}</span>
              <span className="text-on-surface flex-1 truncate">{r.entry!.title}</span>
              <span className="text-on-surface-variant/50 text-[10px]">
                {r.sharedConcepts.slice(0, 2).join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
