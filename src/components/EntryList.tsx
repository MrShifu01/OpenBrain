import { useMemo, useRef, memo } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { TC, fmtD } from "../data/constants";
import { resolveIcon } from "../lib/typeIcons";
import type { Entry } from "../types";

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  note:     { bg: "rgba(114,239,245,0.10)", text: "#72eff5" },
  person:   { bg: "rgba(114,239,245,0.10)", text: "#72eff5" },
  document: { bg: "rgba(213,117,255,0.10)", text: "#d575ff" },
  secret:   { bg: "rgba(255,154,195,0.10)", text: "#ff9ac3" },
  reminder: { bg: "rgba(255,110,132,0.10)", text: "#ff6e84" },
  supplier: { bg: "rgba(213,117,255,0.10)", text: "#d575ff" },
  default:  { bg: "rgba(114,239,245,0.10)", text: "#72eff5" },
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
  const colors = TYPE_COLORS[e.type] || TYPE_COLORS.default;
  return (
    <article
      onClick={() => onSelect(e)}
      className="group cursor-pointer rounded-3xl p-5 border transition-all duration-300 hover:-translate-y-0.5 press-scale"
      style={{ background: "#1a1919", borderColor: "rgba(72,72,71,0.05)" }}
      onMouseEnter={(el) => {
        (el.currentTarget as HTMLElement).style.borderColor = "rgba(114,239,245,0.15)";
        (el.currentTarget as HTMLElement).style.background = "#1e1d1d";
      }}
      onMouseLeave={(el) => {
        (el.currentTarget as HTMLElement).style.borderColor = "rgba(72,72,71,0.05)";
        (el.currentTarget as HTMLElement).style.background = "#1a1919";
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: colors.bg }}
          >
            <span style={{ color: colors.text }}>{cfg.i}</span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/60">
            {e.type}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(e as any).pinned && <span style={{ color: "#72eff5", fontSize: 12 }}>📌</span>}
          {imp && (
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: imp === "Critical" ? "rgba(255,110,132,0.12)" : "rgba(255,154,195,0.10)",
                color: imp === "Critical" ? "#ff6e84" : "#ff9ac3",
              }}
            >
              {imp}
            </span>
          )}
        </div>
      </div>
      <h3
        className="font-bold text-on-surface leading-tight tracking-tight line-clamp-2 mb-2 text-base"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        {e.title}
      </h3>
      {e.type === "secret" ? (
        <p className="text-sm text-on-surface-variant/60 italic mb-3">🔒 Encrypted — tap to reveal</p>
      ) : e.content ? (
        <p className="text-sm text-on-surface-variant line-clamp-2 mb-3 leading-relaxed">
          {e.content as string}
        </p>
      ) : null}
      {(e as any).tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {(e as any).tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "#262626", color: "#d575ff", border: "1px solid rgba(213,117,255,0.12)" }}
            >
              #{tag}
            </span>
          ))}
          {(e as any).tags.length > 3 && (
            <span className="text-[10px] text-on-surface-variant/50 px-1">
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
  const COLS =
    typeof window !== "undefined"
      ? window.innerWidth >= 1280
        ? 3
        : window.innerWidth >= 640
          ? 2
          : 1
      : 1;
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
        style={{ background: "rgba(72,72,71,0.15)" }}
      />
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const e = sorted[vItem.index];
          const cfg = { ...(TC[e.type] || TC.note), i: resolveIcon(e.type, typeIcons) };
          return (
            <div
              key={e.id}
              style={{
                position: "absolute",
                top: vItem.start - virtualizer.options.scrollMargin,
                left: 0,
                right: 0,
              }}
              className="flex items-center gap-4 pl-4 pr-4 py-2.5 cursor-pointer group"
              onClick={() => setSelected(e)}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center z-10"
                style={{ background: "#1a1919", border: "2px solid rgba(114,239,245,0.3)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#72eff5" }} />
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
