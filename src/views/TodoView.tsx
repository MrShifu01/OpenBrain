import { useState, useMemo, useEffect } from "react";
import { fmtD } from "../data/constants";
import { getKarma } from "../lib/karma";
import { useEntries } from "../context/EntriesContext";
import { authFetch } from "../lib/authFetch";
import type { Entry } from "../types";
import {
  type ExternalCalEvent,
  type TodoItem,
  toDateKey,
  fmtTime,
  isDone,
  extractActionDates,
  addRecurring,
} from "./todoUtils";
import TodoQuickAdd from "./TodoQuickAdd";
import TodoCalendarTab from "./TodoCalendarTab";
import TodoEditPopover from "./TodoEditPopover";
import TodoRowItem from "./TodoRowItem";

/* ─── Karma Bar ─── */
function KarmaBar({ points, streak }: { points: number; streak: number }) {
  const level = Math.floor(points / 100);
  const progress = (points % 100) / 100;
  return (
    <div className="flex items-center gap-3">
      {streak > 1 && (
        <span
          style={{
            fontSize: 11,
            color: "var(--ember)",
            fontFamily: "var(--f-sans)",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          🔥 {streak}d
        </span>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span style={{ fontSize: 10, color: "var(--ink-faint)", fontFamily: "var(--f-sans)" }}>
          Lv {level} · {points} pts
        </span>
        <div
          style={{
            width: 80,
            height: 4,
            borderRadius: 2,
            background: "var(--surface-high)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: "var(--ember)",
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Calendar event row (no swipe — read-only external event) ─── */
function CalEventRow({ ev }: { ev: ExternalCalEvent }) {
  const timeLabel = ev.allDay ? null : fmtTime(ev.start);
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--moss)", display: "block" }} />
      </span>
      <span className="shrink-0 text-base" style={{ lineHeight: 1 }}>📅</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--ink)" }}>{ev.title}</p>
        {timeLabel && <p className="mt-0.5 text-xs" style={{ color: "var(--ink-faint)" }}>{timeLabel}</p>}
      </div>
      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--moss-wash)", color: "var(--moss)" }}>
        event
      </span>
    </div>
  );
}

/* ─── Main TodoView ─── */
interface TodoViewProps {
  entries?: Entry[];
  typeIcons?: Record<string, string>;
  activeBrainId?: string;
}

type Tab = "today" | "list" | "calendar";

export default function TodoView({ entries: propEntries, typeIcons = {}, activeBrainId }: TodoViewProps) {
  const ctx = useEntries();
  const entries = propEntries || ctx?.entries || [];
  const [tab, setTab] = useState<Tab>("today");
  const [showCompleted, setShowCompleted] = useState(false);
  const [editState, setEditState] = useState<{ entry: Entry; rect: DOMRect } | null>(null);
  const [karma, setKarma] = useState(getKarma());

  async function handleEditSave(changes: Partial<Entry>) {
    if (!ctx?.handleUpdate || !editState) return;
    await ctx.handleUpdate(editState.entry.id, changes);
  }

  function handleKarmaChange(points: number, streak: number) {
    setKarma({ points, streak });
  }

  /* External calendar events */
  const [externalEvents, setExternalEvents] = useState<ExternalCalEvent[]>([]);
  useEffect(() => {
    authFetch("/api/calendar?action=events")
      .then((r) => r?.json?.())
      .then((d) => { if (Array.isArray(d?.events)) setExternalEvents(d.events); })
      .catch(() => null);
  }, []);

  const mkAdd = (map: Record<string, Entry[]>) => (key: string, e: Entry) => {
    if (!map[key]) map[key] = [];
    if (!map[key].find((x) => x.id === e.id)) map[key].push(e);
  };

  const taskMap = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    const add = mkAdd(map);
    entries.forEach((e) => { if (!isDone(e)) extractActionDates(e).forEach((d) => add(d, e)); });
    addRecurring(entries, add);
    return map;
  }, [entries]);

  const calEventMap = useMemo(() => {
    const map: Record<string, ExternalCalEvent[]> = {};
    externalEvents.forEach((ev) => {
      const key = ev.start.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [externalEvents]);

  const { weekDays, mondayKey, todayKey } = useMemo(() => {
    const now = new Date();
    const todayKey = toDateKey(now);
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    return { weekDays, mondayKey: toDateKey(monday), todayKey };
  }, []);

  const overdue = useMemo(() => {
    const seen = new Set<string>();
    return entries
      .filter((e) => !isDone(e))
      .flatMap((e) => extractActionDates(e).map((d) => ({ entry: e, dateStr: d })))
      .filter(({ entry, dateStr }) => {
        if (dateStr >= mondayKey) return false;
        const k = `${entry.id}-${dateStr}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [entries, mondayKey]);

  const todoList = useMemo(
    () => entries.filter((e) => !isDone(e) && e.type === "todo" && extractActionDates(e).length === 0),
    [entries],
  );

  const completed = useMemo(() => entries.filter(isDone), [entries]);
  const weekItemCount = weekDays.reduce((n, d) => n + (taskMap[toDateKey(d)]?.length || 0), 0);
  const total = overdue.length + weekItemCount + todoList.length;

  /* ── My Day data ── */
  const todayItems = taskMap[todayKey] || [];
  const todayCalEvents = calEventMap[todayKey] || [];
  const todayTotal = overdue.length + todayItems.length + todayCalEvents.length;

  function renderSwipeableItem(item: TodoItem, showDate: boolean) {
    return (
      <TodoRowItem
        key={`${item.entry.id}-${item.dateStr}`}
        entry={item.entry}
        dateStr={showDate ? fmtD(item.dateStr) : undefined}
        showDate={showDate}
        showIcon={false}
        typeIcons={typeIcons}
        ctx={ctx}
        onEdit={(entry, rect) => setEditState({ entry, rect })}
        onKarmaChange={handleKarmaChange}
      />
    );
  }

  function renderEntryRow(entry: Entry) {
    return (
      <TodoRowItem
        key={entry.id}
        entry={entry}
        showIcon={false}
        typeIcons={typeIcons}
        ctx={ctx}
        onEdit={(e, rect) => setEditState({ entry: e, rect })}
        onKarmaChange={handleKarmaChange}
      />
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "today", label: "My Day" },
    { id: "list", label: "Week" },
    { id: "calendar", label: "Calendar" },
  ];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      {/* Desktop header */}
      <header
        className="hidden lg:flex"
        style={{
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: "1px solid var(--line-soft)",
          minHeight: 68,
          gap: 20,
        }}
      >
        <div>
          <h1
            className="f-serif"
            style={{ fontSize: 22, fontWeight: 450, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}
          >
            Todos
          </h1>
          <div className="f-serif" style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 2 }}>
            {total > 0 ? `${total} active · ${completed.length} done` : "your focused task list"}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <KarmaBar points={karma.points} streak={karma.streak} />
          {/* Tab switcher */}
          <div className="flex items-center overflow-hidden rounded-xl border" style={{ borderColor: "var(--line-soft)" }}>
            {TABS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  background: tab === t.id ? "var(--ember)" : "var(--surface)",
                  color: tab === t.id ? "var(--ember-ink)" : "var(--ink-soft)",
                  borderRight: i < TABS.length - 1 ? "1px solid var(--line-soft)" : "none",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ padding: "16px 24px 120px", maxWidth: tab === "calendar" ? 1100 : 780, margin: "0 auto" }}>
        {/* Mobile tab switcher */}
        <div className="mb-4 flex items-center overflow-hidden rounded-xl border lg:hidden" style={{ borderColor: "var(--line-soft)" }}>
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: tab === t.id ? "var(--ember)" : "var(--surface)",
                color: tab === t.id ? "var(--ember-ink)" : "var(--ink-soft)",
                borderRight: i < TABS.length - 1 ? "1px solid var(--line-soft)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Mobile karma bar */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <span style={{ fontSize: 12, color: "var(--ink-faint)", fontFamily: "var(--f-sans)" }}>
            {todayTotal > 0 ? `${todayTotal} for today` : ""}
          </span>
          <KarmaBar points={karma.points} streak={karma.streak} />
        </div>

        {/* ── Calendar tab ── */}
        {tab === "calendar" && (
          <TodoCalendarTab
            entries={entries}
            externalEvents={externalEvents}
            brainId={activeBrainId}
            onAdded={() => ctx?.refreshEntries()}
          />
        )}

        {/* ── My Day tab ── */}
        {tab === "today" && (
          <>
            <div className="mb-4">
              <TodoQuickAdd brainId={activeBrainId} onAdded={() => ctx?.refreshEntries()} />
            </div>

            <div className="mt-6 space-y-6">
              {overdue.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--blood)" }} />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: "var(--f-sans)", color: "var(--blood)" }}>
                      Overdue
                    </p>
                    <span className="inline-flex items-center justify-center rounded-full text-[10px] font-medium" style={{ width: 18, height: 18, background: "var(--blood-wash)", color: "var(--blood)" }}>
                      {overdue.length}
                    </span>
                  </div>
                  <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                    {overdue.map((item) => renderSwipeableItem(item, true))}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="f-sans inline-flex shrink-0 items-center justify-center"
                    style={{
                      background: "var(--ember)",
                      color: "var(--ember-ink)",
                      borderRadius: 999,
                      padding: "4px 8px 3px",
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      lineHeight: 1,
                    }}
                  >
                    Today
                  </span>
                  <span className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                </div>
                {todayItems.length > 0 || todayCalEvents.length > 0 ? (
                  <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                    {todayCalEvents.map((ev) => <CalEventRow key={ev.id} ev={ev} />)}
                    {todayItems.map((entry) => renderSwipeableItem({ entry, dateStr: todayKey }, false))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div style={{ fontSize: 32, opacity: 0.25, marginBottom: 8 }}>☀️</div>
                    <p className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>Nothing scheduled for today</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--ink-faint)" }}>Add a todo above or assign due dates to entries</p>
                  </div>
                )}
              </div>

              {todoList.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--ember)" }} />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: "var(--f-sans)", color: "var(--ember)" }}>
                      Undated
                    </p>
                    <span className="inline-flex items-center justify-center rounded-full text-[10px] font-medium" style={{ width: 18, height: 18, background: "var(--ember-wash)", color: "var(--ember)" }}>
                      {todoList.length}
                    </span>
                  </div>
                  <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                    {todoList.map(renderEntryRow)}
                  </div>
                </div>
              )}

              {todayTotal === 0 && todoList.length === 0 && completed.length === 0 && (
                <div className="mt-8 flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4" style={{ fontSize: 40, opacity: 0.3 }}>☑</div>
                  <p className="mb-1 text-lg font-semibold" style={{ fontFamily: "var(--f-sans)", color: "var(--ink)" }}>All clear</p>
                  <p className="max-w-xs text-sm" style={{ color: "var(--ink-faint)" }}>Add todos above, or they'll appear automatically when entries have due dates.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Week tab ── */}
        {tab === "list" && (
          <>
            <div className="mb-4">
              <TodoQuickAdd brainId={activeBrainId} onAdded={() => ctx?.refreshEntries()} />
            </div>

            <div className="mt-6 space-y-6">
              {overdue.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--blood)" }} />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: "var(--f-sans)", color: "var(--blood)" }}>
                      Overdue
                    </p>
                    <span className="inline-flex items-center justify-center rounded-full text-[10px] font-medium" style={{ width: 18, height: 18, background: "var(--blood-wash)", color: "var(--blood)" }}>
                      {overdue.length}
                    </span>
                  </div>
                  <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                    {overdue.map((item) => renderSwipeableItem(item, true))}
                  </div>
                </div>
              )}

              {weekDays.map((dayDate) => {
                const key = toDateKey(dayDate);
                const isToday = key === todayKey;
                const isPast = key < todayKey;
                const items = taskMap[key] || [];
                const events = calEventMap[key] || [];
                const hasContent = items.length > 0 || events.length > 0;
                const dayLabel = dayDate.toLocaleDateString("en-ZA", { weekday: "short" });
                const dateLabel = dayDate.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

                return (
                  <div key={key} style={{ opacity: isPast ? 0.5 : 1 }}>
                    <div className="mb-2 flex items-center gap-2">
                      {isToday && (
                        <span
                          className="f-sans inline-flex shrink-0 items-center justify-center"
                          style={{
                            background: "var(--ember)",
                            color: "var(--ember-ink)",
                            borderRadius: 999,
                            padding: "4px 8px 3px",
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            lineHeight: 1,
                          }}
                        >
                          Today
                        </span>
                      )}
                      <span className="f-sans" style={{ fontSize: 12, fontWeight: 600, color: isToday ? "var(--ink)" : "var(--ink-soft)" }}>
                        {dayLabel}
                      </span>
                      <span className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                        {dateLabel}
                      </span>
                      {hasContent && (
                        <span className="f-sans ml-auto" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
                          {events.length + items.length}
                        </span>
                      )}
                    </div>
                    {hasContent ? (
                      <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                        {events.map((ev) => <CalEventRow key={ev.id} ev={ev} />)}
                        {items.map((entry) => renderSwipeableItem({ entry, dateStr: key }, false))}
                      </div>
                    ) : (
                      <div style={{ height: 1, background: "var(--line-soft)", margin: "4px 2px" }} />
                    )}
                  </div>
                );
              })}

              {todoList.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--ember)" }} />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: "var(--f-sans)", color: "var(--ember)" }}>
                      To Do
                    </p>
                    <span className="inline-flex items-center justify-center rounded-full text-[10px] font-medium" style={{ width: 18, height: 18, background: "var(--ember-wash)", color: "var(--ember)" }}>
                      {todoList.length}
                    </span>
                  </div>
                  <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                    {todoList.map(renderEntryRow)}
                  </div>
                </div>
              )}

              {completed.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowCompleted((s) => !s)}
                    className="flex w-full items-center gap-2 py-1"
                  >
                    <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--ink-ghost)" }} />
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: "var(--f-sans)", color: "var(--ink-faint)" }}>
                      Completed
                    </p>
                    <span className="inline-flex items-center justify-center rounded-full text-[10px] font-medium" style={{ width: 18, height: 18, background: "var(--surface-high)", color: "var(--ink-faint)" }}>
                      {completed.length}
                    </span>
                    <span className="f-sans ml-auto text-xs" style={{ color: "var(--ink-ghost)" }}>
                      {showCompleted ? "▾" : "▸"}
                    </span>
                  </button>
                  {showCompleted && (
                    <div className="mt-2 divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                      {completed.map(renderEntryRow)}
                    </div>
                  )}
                </div>
              )}

              {total === 0 && completed.length === 0 && (
                <div className="mt-8 flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4" style={{ fontSize: 40, opacity: 0.3 }}>☑</div>
                  <p className="mb-1 text-lg font-semibold" style={{ fontFamily: "var(--f-sans)", color: "var(--ink)" }}>All clear</p>
                  <p className="max-w-xs text-sm" style={{ color: "var(--ink-faint)" }}>Add todos above, or they'll appear automatically when entries have due dates.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {editState && (
        <TodoEditPopover
          entry={editState.entry}
          rect={editState.rect}
          onClose={() => setEditState(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}

export type { ExternalCalEvent } from "./todoUtils";
