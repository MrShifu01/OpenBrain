import { useMemo, useRef, memo, useState, useEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { fmtD } from "../data/constants";
import type { Entry } from "../types";

// All colors reference CSS variables so they respond correctly to light/dark mode.
const TYPE_THEME: Record<string, { bg: string; text: string }> = {
  note: { bg: "var(--color-primary-container)", text: "var(--color-primary)" },
  person: { bg: "var(--color-primary-container)", text: "var(--color-primary)" },
  document: { bg: "var(--color-secondary-container)", text: "var(--color-secondary)" },
  secret: {
    bg: "color-mix(in oklch, var(--color-error) 12%, var(--color-surface-container))",
    text: "var(--color-error)",
  },
  reminder: {
    bg: "color-mix(in oklch, var(--color-error) 12%, var(--color-surface-container))",
    text: "var(--color-error)",
  },
  supplier: { bg: "var(--color-secondary-container)", text: "var(--color-secondary)" },
  default: { bg: "var(--color-primary-container)", text: "var(--color-primary)" },
};

const EntryCard = memo(function EntryCard({
  entry: e,
  onSelect,
  typeIcons: _typeIcons = {},
  onPin,
  onDelete,
}: {
  entry: Entry;
  onSelect: (e: Entry) => void;
  typeIcons?: Record<string, string>;
  onPin?: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
}) {
  const importance = (e as any).importance as number;
  const imp = ({ 1: "Important", 2: "Critical" } as Record<number, string>)[importance];
  const isPinned = !!(e as any).pinned;
  const isCritical = importance === 2;
  const colors = TYPE_THEME[e.type] || TYPE_THEME.default;

  return (
    <article
      tabIndex={0}
      onClick={() => onSelect(e)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onSelect(e);
        }
      }}
      aria-label={e.title}
      {...(isPinned ? { "data-pinned": "true" } : {})}
      {...(importance > 0 ? { "data-importance": String(importance) } : {})}
      className={`entry-card${isCritical ? "entry-card--critical" : isPinned ? "entry-card--pinned" : ""} group press-scale cursor-pointer rounded-2xl border p-5 transition-all duration-200`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <p
            className="rounded-lg px-2 py-0.5 text-xs font-medium"
            style={{ background: colors.bg, color: colors.text }}
          >
            {e.type.charAt(0).toUpperCase() + e.type.slice(1)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(e as any).pinned && (
            <span style={{ color: "var(--color-primary)", fontSize: 12 }}>📌</span>
          )}
          {imp && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background:
                  imp === "Critical"
                    ? "color-mix(in oklch, var(--color-error) 14%, var(--color-surface-container))"
                    : "var(--color-primary-container)",
                color:
                  imp === "Critical" ? "var(--color-error)" : "var(--color-on-primary-container)",
              }}
            >
              {imp}
            </span>
          )}
        </div>
      </div>
      <h3 className="text-on-surface mb-2 line-clamp-2 text-base leading-snug font-semibold tracking-tight">
        {e.title}
      </h3>
      {e.type === "secret" ? (
        <p className="mb-3 text-sm italic" style={{ color: "var(--color-on-surface-variant)" }}>
          🔒 Encrypted — tap to reveal
        </p>
      ) : e.content ? (
        <p
          className="mb-3 line-clamp-2 text-sm leading-relaxed"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          {e.content as string}
        </p>
      ) : null}
      {(e as any).tags?.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5">
          {(e as any).tags.slice(0, 3).map((tag: string) => (
            <span
              key={tag}
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "var(--color-secondary-container)",
                color: "var(--color-secondary)",
              }}
            >
              {tag}
            </span>
          ))}
          {(e as any).tags.length > 3 && (
            <span className="px-1 text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
              +{(e as any).tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Quick actions — subtle at rest, vivid on hover */}
      {(onPin || onDelete) && (
        <div
          className="mt-3 flex items-center gap-1 border-t pt-2.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100"
          style={{ borderColor: "var(--color-outline-variant)" }}
        >
          {onPin && (
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onPin(e);
              }}
              aria-label={isPinned ? "Unpin" : "Pin"}
              className="hover:bg-surface-container-high press-scale flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                />
              </svg>
              {isPinned ? "Unpin" : "Pin"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onDelete(e);
              }}
              aria-label="Delete"
              className="entry-card__delete press-scale ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
              Delete
            </button>
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
  onPin,
  onDelete,
}: {
  filtered: Entry[];
  setSelected: (e: Entry) => void;
  typeIcons?: Record<string, string>;
  onPin?: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
}) {
  const [COLS, setCOLS] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth >= 1280
        ? 3
        : window.innerWidth >= 640
          ? 2
          : 1
      : 1,
  );
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setCOLS(w >= 1024 ? 3 : w >= 560 ? 2 : 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rows = useMemo(() => {
    const r: Entry[][] = [];
    for (let i = 0; i < filtered.length; i += COLS) r.push(filtered.slice(i, i + COLS));
    return r;
  }, [filtered, COLS]);
  const listRef = useRef<HTMLDivElement>(null);
  const ROW_GAP = 16;
  // eslint-disable-next-line react-hooks/refs
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 190 + ROW_GAP,
    overscan: 4,
    scrollMargin: listRef.current?.offsetTop ?? 0, // eslint-disable-line react-hooks/refs
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
              <EntryCard
                key={e.id}
                entry={e}
                onSelect={setSelected}
                typeIcons={typeIcons}
                onPin={onPin}
                onDelete={onDelete}
              />
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
  typeIcons: _typeIcons = {},
}: {
  sorted: Entry[];
  setSelected: (e: Entry) => void;
  typeIcons?: Record<string, string>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/refs
  const virtualizer = useWindowVirtualizer({
    count: sorted.length,
    estimateSize: () => 64,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0, // eslint-disable-line react-hooks/refs
  });
  return (
    <div ref={listRef} className="relative">
      <div
        className="absolute top-0 bottom-0 left-6 w-px"
        style={{ background: "var(--color-outline-variant)" }}
      />
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vItem) => {
          const e = sorted[vItem.index];
          return (
            <button
              key={e.id}
              aria-label={e.title}
              style={{
                position: "absolute",
                top: vItem.start - virtualizer.options.scrollMargin,
                left: 0,
                right: 0,
              }}
              className="group flex w-full cursor-pointer appearance-none items-center gap-4 border-0 bg-transparent py-2.5 pr-4 pl-4 text-left"
              onClick={() => setSelected(e)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setSelected(e);
                }
              }}
            >
              <div
                className="z-10 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--color-surface-container-low)",
                  border: "2px solid var(--color-primary)",
                }}
              >
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--color-primary)" }}
                />
              </div>
              <p className="text-on-surface-variant/50 w-20 flex-shrink-0 text-xs font-semibold tracking-widest uppercase">
                {fmtD(e.created_at ?? "")}
              </p>
              <div className="group-hover:bg-surface-container flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 transition-colors">
                <span className="text-on-surface truncate text-sm">{e.title}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
