import { useMemo, useRef, memo, useState, useEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { TC, fmtD } from "../data/constants";
import { resolveIcon } from "../lib/typeIcons";
import type { Entry } from "../types";

// All colors reference CSS variables so they respond correctly to light/dark mode.
const TYPE_THEME: Record<string, { bg: string; text: string }> = {
  note:     { bg: "var(--color-primary-container)",   text: "var(--color-primary)" },
  person:   { bg: "var(--color-primary-container)",   text: "var(--color-primary)" },
  document: { bg: "var(--color-secondary-container)", text: "var(--color-secondary)" },
  secret:   { bg: "color-mix(in oklch, var(--color-error) 12%, var(--color-surface-container))", text: "var(--color-error)" },
  reminder: { bg: "color-mix(in oklch, var(--color-error) 12%, var(--color-surface-container))", text: "var(--color-error)" },
  supplier: { bg: "var(--color-secondary-container)", text: "var(--color-secondary)" },
  default:  { bg: "var(--color-primary-container)",   text: "var(--color-primary)" },
};

const EntryCard = memo(function EntryCard({
  entry: e,
  onSelect,
  typeIcons = {},
}: {
  entry: Entry;
  onSelect: (e: Entry) => void;
  typeIcons?: Record<string, string>;
}) {
  const cfg = { ...(TC[e.type] || TC.note), i: resolveIcon(e.type, typeIcons) };
  const imp = ({ 1: "Important", 2: "Critical" } as Record<number, string>)[(e as any).importance];
  const colors = TYPE_THEME[e.type] || TYPE_THEME.default;
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(e)}
      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(e); } }}
      aria-label={e.title}
      className="group cursor-pointer rounded-2xl p-5 border transition-all duration-200 hover:-translate-y-0.5 press-scale"
      style={{
        background: "var(--color-surface-container-low)",
        borderColor: "var(--color-outline-variant)",
      }}
      onMouseEnter={(el) => {
        (el.currentTarget as HTMLElement).style.background = "var(--color-surface-container)";
        (el.currentTarget as HTMLElement).style.borderColor = "var(--color-outline)";
      }}
      onMouseLeave={(el) => {
        (el.currentTarget as HTMLElement).style.background = "var(--color-surface-container-low)";
        (el.currentTarget as HTMLElement).style.borderColor = "var(--color-outline-variant)";
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: colors.bg }}
          >
            <span style={{ color: colors.text }}>{cfg.i}</span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-on-surface-variant)" }}>
            {e.type}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(e as any).pinned && <span style={{ color: "var(--color-primary)", fontSize: 12 }}>📌</span>}
          {imp && (
            <span
              className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: imp === "Critical"
                  ? "color-mix(in oklch, var(--color-error) 14%, var(--color-surface-container))"
                  : "var(--color-primary-container)",
                color: imp === "Critical" ? "var(--color-error)" : "var(--color-on-primary-container)",
              }}
            >
              {imp}
            </span>
          )}
        </div>
      </div>
      <h3 className="font-semibold text-on-surface leading-snug tracking-tight line-clamp-2 mb-2 text-base">
        {e.title}
      </h3>
      {e.type === "secret" ? (
        <p className="text-sm italic mb-3" style={{ color: "var(--color-on-surface-variant)" }}>🔒 Encrypted — tap to reveal</p>
      ) : e.content ? (
        <p className="text-sm line-clamp-2 mb-3 leading-relaxed" style={{ color: "var(--color-on-surface-variant)" }}>
          {e.content as string}
        </p>
      ) : null}
      {(e as any).tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {(e as any).tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: "var(--color-secondary-container)",
                color: "var(--color-secondary)",
              }}
            >
              #{tag}
            </span>
          ))}
          {(e as any).tags.length > 3 && (
            <span className="text-[10px] px-1" style={{ color: "var(--color-on-surface-variant)" }}>
              +{(e as any).tags.length - 3}
            </span>
          )}
        </div>
      )}
    </article>
  );
});

export function VirtualGrid({
  filtered,
  setSelected,
  typeIcons = {},
}: {
  filtered: Entry[];
  setSelected: (e: Entry) => void;
  typeIcons?: Record<string, string>;
}) {
  const [COLS, setCOLS] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth >= 1280 ? 3 : window.innerWidth >= 640 ? 2 : 1
      : 1
  );
  useEffect(() => {
    function update() {
      setCOLS(window.innerWidth >= 1280 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const rows = useMemo(() => {
    const r: Entry[][] = [];
    for (let i = 0; i < filtered.length; i += COLS) r.push(filtered.slice(i, i + COLS));
    return r;
  }, [filtered, COLS]);
  const listRef = useRef<HTMLDivElement>(null);
  const ROW_GAP = 16;
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 190 + ROW_GAP,
    overscan: 4,
    scrollMargin: listRef.current?.offsetTop ?? 0,
    measureElement: (el) => el.getBoundingClientRect().height,
  });
  return (
    <div ref={listRef}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vRow) => (
          <div
            key={vRow.index}
            data-index={vRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: vRow.start - virtualizer.options.scrollMargin,
              left: 0,
              right: 0,
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: "16px",
              paddingBottom: "16px",
            }}
          >
            {rows[vRow.index].map((e) => (
              <EntryCard key={e.id} entry={e} onSelect={setSelected} typeIcons={typeIcons} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function VirtualTimeline({
  sorted,
  setSelected,
  typeIcons = {},
}: {
  sorted: Entry[];
  setSelected: (e: Entry) => void;
  typeIcons?: Record<string, string>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: sorted.length,
    estimateSize: () => 64,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  return (
    <div ref={listRef} className="relative">
      <div
        className="absolute left-6 top-0 bottom-0 w-px"
        style={{ background: "var(--color-outline-variant)" }}
      />
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const e = sorted[vItem.index];
          const cfg = { ...(TC[e.type] || TC.note), i: resolveIcon(e.type, typeIcons) };
          return (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              aria-label={e.title}
              style={{
                position: "absolute",
                top: vItem.start - virtualizer.options.scrollMargin,
                left: 0,
                right: 0,
              }}
              className="flex items-center gap-4 pl-4 pr-4 py-2.5 cursor-pointer group"
              onClick={() => setSelected(e)}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setSelected(e); } }}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center z-10"
                style={{ background: "var(--color-surface-container-low)", border: "2px solid var(--color-primary)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-primary)" }} />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 font-semibold flex-shrink-0 w-20">
                {fmtD(e.created_at)}
              </p>
              <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 rounded-xl transition-colors group-hover:bg-surface-container">
                <span className="text-sm flex-shrink-0">{cfg.i}</span>
                <span className="text-sm text-on-surface truncate">{e.title}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
