// Virtualisers for the memory grid + timeline. The card and row
// presentations live in sibling files so this stays focused on the
// windowing logic.
//
//   - EntryCard.tsx → grid card + timeline card body
//   - EntryRow.tsx  → list row body
//
// Public exports are unchanged: `VirtualGrid` and `VirtualTimeline` are
// the two entry points used by Everion.tsx.

import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { Entry } from "../types";
import { EntryCard } from "./EntryCard";
import { EntryRow } from "./EntryRow";
import { Separator } from "./ui/separator";

export function VirtualGrid({
  filtered,
  setSelected,
  typeIcons = {},
  onPin,
  onDelete,
  selectMode = false,
  selectedIds,
  onToggleSelect,
  viewMode = "grid",
  conceptMap,
}: {
  filtered: Entry[];
  setSelected: (e: Entry) => void;
  typeIcons?: Record<string, string>;
  onPin?: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  viewMode?: "grid" | "list";
  conceptMap?: Record<string, string[]>;
}) {
  const isList = viewMode === "list";
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
    if (isList) return;
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setCOLS(w >= 1024 ? 3 : w >= 560 ? 2 : 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isList]);
  const cols = isList ? 1 : COLS;
  const rows = useMemo(() => {
    const r: Entry[][] = [];
    for (let i = 0; i < filtered.length; i += cols) r.push(filtered.slice(i, i + cols));
    return r;
  }, [filtered, cols]);
  const listRef = useRef<HTMLDivElement>(null);
  const ROW_GAP = 16;
  // eslint-disable-next-line react-hooks/refs
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => (isList ? 60 : 190 + ROW_GAP),
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
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: isList ? "8px" : "16px",
              paddingBottom: isList ? "8px" : "16px",
            }}
          >
            {rows[vRow.index].map((e) =>
              isList ? (
                <EntryRow
                  key={e.id}
                  entry={e}
                  onSelect={setSelected}
                  onPin={selectMode ? undefined : onPin}
                  onDelete={selectMode ? undefined : onDelete}
                  selectMode={selectMode}
                  selected={selectedIds?.has(e.id) ?? false}
                  onToggleSelect={onToggleSelect}
                  typeIcons={typeIcons}
                />
              ) : (
                <EntryCard
                  key={e.id}
                  entry={e}
                  onSelect={setSelected}
                  typeIcons={typeIcons}
                  onPin={selectMode ? undefined : onPin}
                  onDelete={selectMode ? undefined : onDelete}
                  selectMode={selectMode}
                  selected={selectedIds?.has(e.id) ?? false}
                  onToggleSelect={onToggleSelect}
                  concepts={conceptMap?.[e.id]}
                />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - d.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" }).toLowerCase();
  }
  return d
    .toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
    .toLowerCase();
}

function dayShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toLowerCase();
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
  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of sorted) {
      const iso = e.created_at;
      if (!iso) continue;
      const key = String(iso).slice(0, 10);
      const arr = m.get(key);
      if (arr) arr.push(e);
      else m.set(key, [e]);
    }
    return [...m.entries()];
  }, [sorted]);

  if (byDay.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ padding: "80px 20px", textAlign: "center" }}
      >
        <h3
          className="f-serif"
          style={{ fontSize: 22, fontWeight: 450, color: "var(--ink)", margin: 0 }}
        >
          nothing on the timeline yet.
        </h3>
        <p
          className="f-serif"
          style={{
            fontSize: 15,
            fontStyle: "italic",
            color: "var(--ink-faint)",
            margin: "8px 0 0",
          }}
        >
          remember something.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      {byDay.map(([day, items]) => (
        <section key={day} style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <h3
              className="f-serif"
              style={{
                fontSize: 22,
                fontStyle: "italic",
                fontWeight: 450,
                letterSpacing: "-0.005em",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              {dayLabel(day)}
            </h3>
            <Separator className="flex-1" />
            <div
              className="f-sans"
              style={{ fontSize: 12, color: "var(--ink-faint)", flexShrink: 0 }}
            >
              {dayShort(day)}
            </div>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((e) => (
              <EntryCard key={e.id} entry={e} onSelect={setSelected} typeIcons={typeIcons} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
