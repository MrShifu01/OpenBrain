import { useState, useMemo, useEffect, useRef } from "react";
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
  getPlacements,
  getActionPlacements,
} from "./todoUtils";
import TodoQuickAdd from "./TodoQuickAdd";
import TodoCalendarTab from "./TodoCalendarTab";
import TodoEditPopover from "./TodoEditPopover";
import TodoRowItem from "./TodoRowItem";
import TodoSomedayTab from "./TodoSomedayTab";

/* ─── Week-view premium card primitives ─── */
//
// These match the calendar tab's design language: rounded-card hierarchy,
// ember accent for "today" + "internal", blue accent for external events,
// soft surface-low chips inside white surface day cards. Everything binds
// to design tokens so all three families (dusk / paper / bronze) × both
// modes work without per-theme branches.

function WeekDayCard({
  isToday,
  isPast,
  children,
}: {
  isToday?: boolean;
  isPast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="week-day-card"
      style={{
        background: isToday
          ? "color-mix(in oklch, var(--ember-wash) 70%, var(--surface))"
          : "var(--surface)",
        border: isToday
          ? "1px solid color-mix(in oklch, var(--ember) 32%, var(--line-soft))"
          : "1px solid var(--line-soft)",
        borderRadius: 16,
        padding: 16,
        boxShadow: "var(--lift-1)",
        opacity: isPast && !isToday ? 0.55 : 1,
        transition: "transform 180ms ease, box-shadow 180ms ease",
        // Left-edge gold accent for today — chosen over a full tint-only
        // because it reads as "this is now" without dominating the card.
        ...(isToday ? { borderLeft: "3px solid var(--ember)" } : {}),
      }}
    >
      {children}
    </div>
  );
}

function WeekDayHeader({
  label,
  date,
  count,
  isToday,
  accent,
  trailing,
}: {
  label: string;
  date?: string;
  count?: number;
  isToday?: boolean;
  accent?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className="f-sans"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: isToday ? "var(--ember)" : (accent ?? "var(--ink)"),
        }}
      >
        {label}
      </span>
      {date && <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{date}</span>}
      {isToday && (
        <span
          style={{
            background: "var(--ember)",
            color: "var(--ember-ink)",
            borderRadius: 999,
            padding: "3px 8px 2px",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          Today
        </span>
      )}
      {typeof count === "number" && count > 0 && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--ink-ghost)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </span>
      )}
      {trailing && <span style={{ marginLeft: count !== undefined ? 8 : "auto" }}>{trailing}</span>}
    </div>
  );
}

/** Wraps a TodoRowItem (or any inner row) in the premium item-card chrome.
 *  overflow: hidden contains the swipe-action backgrounds inside the
 *  card's rounded shape, which incidentally looks cleaner than the
 *  bordered-row treatment that was here before. */
function WeekItemCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="week-item-card"
      style={{
        background: "var(--surface-low)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
    >
      {children}
    </div>
  );
}

/** External calendar event as a premium card — distinct from the
 *  legacy CalEventRow because the Week tab now uses card chrome. */
function WeekEventCard({ ev }: { ev: ExternalCalEvent }) {
  const time = ev.allDay ? "All day" : fmtTime(ev.start);
  const blue = "oklch(58% 0.13 248)";
  return (
    <div
      className="week-item-card"
      style={{
        background: "var(--surface-low)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: blue,
          flexShrink: 0,
          marginTop: 7,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          className="f-sans"
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink)",
            lineHeight: 1.35,
            wordBreak: "break-word",
          }}
        >
          {ev.title}
        </p>
        <p
          className="f-sans"
          style={{
            margin: "3px 0 0",
            fontSize: 11,
            color: "var(--ink-faint)",
          }}
        >
          {time}
        </p>
      </div>
      <span
        className="f-sans"
        style={{
          background: `color-mix(in oklch, ${blue} 12%, var(--surface-high))`,
          color: blue,
          borderRadius: 999,
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          flexShrink: 0,
          alignSelf: "flex-start",
        }}
      >
        Event
      </span>
    </div>
  );
}

function WeekFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add todo"
      className="press"
      style={{
        position: "fixed",
        right: 24,
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        height: 52,
        width: 52,
        borderRadius: 999,
        background: "var(--ember)",
        color: "var(--ember-ink)",
        border: 0,
        boxShadow: "var(--lift-3)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
      }}
    >
      <svg
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

/* ─── Calendar event row (legacy, used by My Day tab — keeps that tab's
   visual stable while the Week tab moves to the new card system) ─── */
function CalEventRow({ ev }: { ev: ExternalCalEvent }) {
  const timeLabel = ev.allDay ? null : fmtTime(ev.start);
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        style={{
          width: 18,
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--moss)",
            display: "block",
          }}
        />
      </span>
      <span className="shrink-0 text-base" style={{ lineHeight: 1 }}>
        📅
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--ink)" }}>
          {ev.title}
        </p>
        {timeLabel && (
          <p className="mt-0.5 text-xs" style={{ color: "var(--ink-faint)" }}>
            {timeLabel}
          </p>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ background: "var(--moss-wash)", color: "var(--moss)" }}
      >
        event
      </span>
    </div>
  );
}

/* ─── Done today section (Phase 4 of schedule fix) ─── */
//
// Completed items used to vanish from My Day. With one accidental swipe a
// user lost the entry until they navigated to Week → Completed (collapsed
// by default) and re-opened it. This pane sits at the bottom of My Day,
// collapsed by default, with a per-row Reopen button that flips status
// back to "todo" — undo for the whole day, not just the last action.

function DoneTodaySection({
  items,
  onReopen,
}: {
  items: Entry[];
  onReopen: (id: string, entry: Entry) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="press"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: 0,
          padding: "6px 4px",
          cursor: "pointer",
          color: "var(--ink-faint)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--moss-wash, color-mix(in oklch, var(--ember) 12%, transparent))",
            color: "var(--moss, var(--ember))",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          ✓
        </span>
        <span
          className="f-sans"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Done today · {items.length}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div
          className="divide-y rounded-2xl border px-3"
          style={{ background: "var(--surface)", borderColor: "var(--line-soft)", marginTop: 6 }}
        >
          {items.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 py-2.5" style={{ opacity: 0.7 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "var(--ember)",
                  color: "var(--ember-ink)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <p
                className="f-sans"
                style={{
                  margin: 0,
                  flex: 1,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  textDecoration: "line-through",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {entry.title}
              </p>
              <button
                onClick={() => onReopen(entry.id, entry)}
                className="press f-sans"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid var(--line-soft)",
                  color: "var(--ember)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Reopen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main TodoView ─── */
interface TodoViewProps {
  entries?: Entry[];
  typeIcons?: Record<string, string>;
  activeBrainId?: string;
  somedayEnabled?: boolean;
}

type Tab = "today" | "list" | "calendar" | "someday";

export default function TodoView({
  entries: propEntries,
  typeIcons = {},
  activeBrainId,
  somedayEnabled = false,
}: TodoViewProps) {
  const ctx = useEntries();
  const entries = propEntries || ctx?.entries || [];
  const [tab, setTab] = useState<Tab>("calendar");
  const [showCompleted, setShowCompleted] = useState(false);
  const [editState, setEditState] = useState<{ entry: Entry; rect: DOMRect } | null>(null);
  const [, setKarma] = useState(getKarma());
  const weekQuickAddRef = useRef<HTMLDivElement>(null);

  function focusWeekQuickAdd() {
    const el = weekQuickAddRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    setTimeout(() => input?.focus(), 320);
  }

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
      .then((d) => {
        if (Array.isArray(d?.events)) setExternalEvents(d.events);
      })
      .catch(() => null);
  }, []);

  const taskMap = useMemo(() => {
    // Wide window: 60 days back to 60 days forward. Covers overdue + this
    // week + a buffer for navigation. Recurrence is expanded once across
    // the whole window so My Day / Week never have to re-compute.
    const today = new Date();
    const back = new Date(today);
    back.setDate(today.getDate() - 60);
    const fwd = new Date(today);
    fwd.setDate(today.getDate() + 60);
    const range = { from: toDateKey(back), to: toDateKey(fwd) };

    const map: Record<string, Entry[]> = {};
    for (const e of entries) {
      const placements = getPlacements(e, {
        mode: "actions",
        range,
        expandRecurrence: true,
      });
      for (const d of placements) {
        if (!map[d]) map[d] = [];
        if (!map[d].find((x) => x.id === e.id)) map[d].push(e);
      }
    }
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
      .flatMap((e) => getActionPlacements(e).map((d) => ({ entry: e, dateStr: d })))
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
    () =>
      entries.filter((e) => !isDone(e) && e.type === "todo" && getActionPlacements(e).length === 0),
    [entries],
  );

  const completed = useMemo(() => entries.filter(isDone), [entries]);
  const weekItemCount = weekDays.reduce((n, d) => n + (taskMap[toDateKey(d)]?.length || 0), 0);
  const total = overdue.length + weekItemCount + todoList.length;

  /* ── My Day data ── */
  const todayItems = taskMap[todayKey] || [];
  const todayCalEvents = calEventMap[todayKey] || [];
  const todayTotal = overdue.length + todayItems.length + todayCalEvents.length;

  // Done today — reversible-completion pane. Phase 4: completed items used
  // to vanish entirely from My Day, so a misclick / accidental swipe meant
  // the entry was gone with no recovery path. Now they appear in a tucked-
  // away "Done today" section with a per-row Reopen button.
  const doneToday = useMemo(() => {
    return entries.filter((e) => {
      if (!isDone(e)) return false;
      const m = (e.metadata || {}) as Record<string, unknown>;
      // Heuristic: a date-bound entry counts as "done today" only if its
      // schedule lands on today. Undated todos count if their updated_at
      // is from today (they were just completed). Anything else is in
      // the Week tab's collapsed Completed section, not My Day.
      const placements = getActionPlacements({
        ...e,
        metadata: { ...m, status: undefined },
      } as Entry);
      if (placements.includes(todayKey)) return true;
      if (placements.length === 0 && e.type === "todo") {
        const updated = String(e.updated_at || "").slice(0, 10);
        return updated === todayKey;
      }
      return false;
    });
  }, [entries, todayKey]);

  const reopenEntry = (id: string, entry: Entry) => {
    if (!ctx?.handleUpdate) return;
    const m = { ...((entry.metadata || {}) as Record<string, unknown>) };
    delete m.status;
    ctx.handleUpdate(id, { metadata: m as Entry["metadata"] }).catch(() => null);
  };

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

  const somedayCount = useMemo(
    () => entries.filter((e) => e.type === "someday" && !isDone(e)).length,
    [entries],
  );

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "today", label: "Day" },
    { id: "list", label: "Week" },
    { id: "calendar", label: "Month" },
    ...(somedayEnabled ? [{ id: "someday" as const, label: "Someday", count: somedayCount }] : []),
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
            style={{
              fontSize: 22,
              fontWeight: 450,
              letterSpacing: "-0.01em",
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Schedule
          </h1>
          <div
            className="f-serif"
            style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 2 }}
          >
            your focused task list
          </div>
        </div>
      </header>

      <div
        style={{
          padding: "16px 24px 120px",
          maxWidth: tab === "calendar" ? 1100 : 780,
          margin: "0 auto",
        }}
      >
        {/* Tab switcher — mobile-only by default, but surfaced on desktop too
            when Someday is enabled so power users can flip between the four
            views without leaving the schedule shell. */}
        <div
          className={`mb-4 flex items-center overflow-hidden rounded-xl border ${somedayEnabled ? "" : "lg:hidden"}`}
          style={{ borderColor: "var(--line-soft)" }}
        >
          {TABS.map((t, i) => {
            const active = tab === t.id;
            // Soft "your pile is growing" nudge — only on Someday, only past
            // 20. No number; the count is one tap away. Ember dot on the
            // inactive tab, white dot on the active one (which has an ember
            // background) so it stays visible either way.
            const showDot = typeof t.count === "number" && t.count > 20;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex-1 py-2 text-sm font-medium transition-colors"
                style={{
                  background: active ? "var(--ember)" : "var(--surface)",
                  color: active ? "var(--ember-ink)" : "var(--ink-soft)",
                  borderRight: i < TABS.length - 1 ? "1px solid var(--line-soft)" : "none",
                }}
              >
                {t.label}
                {showDot && (
                  <span
                    aria-label={`${t.count} items`}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 8,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: active ? "var(--ember-ink)" : "var(--ember)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Calendar tab ── */}
        {tab === "calendar" && (
          <TodoCalendarTab
            entries={entries}
            externalEvents={externalEvents}
            brainId={activeBrainId}
            onAdded={() => ctx?.refreshEntries()}
            onUpdate={ctx?.handleUpdate}
            onDelete={ctx?.handleDelete}
          />
        )}

        {/* ── Someday tab ── */}
        {tab === "someday" && somedayEnabled && (
          <TodoSomedayTab
            entries={entries}
            brainId={activeBrainId}
            onUpdate={ctx?.handleUpdate}
            onDelete={ctx?.handleDelete}
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
                    <span
                      className="block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: "var(--blood)" }}
                    />
                    <p
                      className="text-[10px] font-semibold tracking-[0.14em] uppercase"
                      style={{ fontFamily: "var(--f-sans)", color: "var(--blood)" }}
                    >
                      Overdue
                    </p>
                    <span
                      className="inline-flex items-center justify-center rounded-full text-[10px] font-medium"
                      style={{
                        width: 18,
                        height: 18,
                        background: "var(--blood-wash)",
                        color: "var(--blood)",
                      }}
                    >
                      {overdue.length}
                    </span>
                  </div>
                  <div
                    className="divide-y rounded-2xl border px-3"
                    style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}
                  >
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
                    {new Date().toLocaleDateString("en-ZA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                </div>
                {todayItems.length > 0 || todayCalEvents.length > 0 ? (
                  <div
                    className="divide-y rounded-2xl border px-3"
                    style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}
                  >
                    {todayCalEvents.map((ev) => (
                      <CalEventRow key={ev.id} ev={ev} />
                    ))}
                    {todayItems.map((entry) =>
                      renderSwipeableItem({ entry, dateStr: todayKey }, false),
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div style={{ fontSize: 32, opacity: 0.25, marginBottom: 8 }}>☀️</div>
                    <p className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
                      Nothing scheduled for today
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--ink-faint)" }}>
                      Add a todo above or assign due dates to entries
                    </p>
                  </div>
                )}
              </div>

              {todoList.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: "var(--ember)" }}
                    />
                    <p
                      className="text-[10px] font-semibold tracking-[0.14em] uppercase"
                      style={{ fontFamily: "var(--f-sans)", color: "var(--ember)" }}
                    >
                      Undated
                    </p>
                    <span
                      className="inline-flex items-center justify-center rounded-full text-[10px] font-medium"
                      style={{
                        width: 18,
                        height: 18,
                        background: "var(--ember-wash)",
                        color: "var(--ember)",
                      }}
                    >
                      {todoList.length}
                    </span>
                  </div>
                  <div
                    className="divide-y rounded-2xl border px-3"
                    style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}
                  >
                    {todoList.map(renderEntryRow)}
                  </div>
                </div>
              )}

              {doneToday.length > 0 && (
                <DoneTodaySection items={doneToday} onReopen={reopenEntry} />
              )}

              {todayTotal === 0 && todoList.length === 0 && completed.length === 0 && (
                <div className="mt-8 flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "var(--ember-wash)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      style={{ color: "var(--ember)" }}
                      aria-hidden="true"
                    >
                      <path d="M9 11l3 3 7-7" />
                      <path d="M21 12a9 9 0 1 1-9-9" />
                    </svg>
                  </div>
                  <h2
                    className="f-serif"
                    style={{
                      fontSize: 24,
                      fontWeight: 400,
                      letterSpacing: "-0.01em",
                      color: "var(--ink)",
                      margin: 0,
                    }}
                  >
                    All clear.
                  </h2>
                  <p
                    className="f-serif"
                    style={{
                      fontSize: 15,
                      fontStyle: "italic",
                      color: "var(--ink-soft)",
                      margin: 0,
                      maxWidth: 360,
                      lineHeight: 1.55,
                    }}
                  >
                    Add a todo above, or capture an entry with a date and it'll show up here
                    automatically.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Week tab ── */}
        {tab === "list" && (
          <>
            {/* QuickAdd inside its own surface card so it reads as a peer to
                the day cards below — same chrome, same lift. */}
            <div
              ref={weekQuickAddRef}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line-soft)",
                borderRadius: 16,
                padding: 16,
                boxShadow: "var(--lift-1)",
                marginBottom: 20,
              }}
            >
              <TodoQuickAdd brainId={activeBrainId} onAdded={() => ctx?.refreshEntries()} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {overdue.length > 0 && (
                <WeekDayCard>
                  <WeekDayHeader label="Overdue" count={overdue.length} accent="var(--blood)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {overdue.map((item) => (
                      <WeekItemCard key={`${item.entry.id}-${item.dateStr}`}>
                        {renderSwipeableItem(item, true)}
                      </WeekItemCard>
                    ))}
                  </div>
                </WeekDayCard>
              )}

              {weekDays.map((dayDate) => {
                const key = toDateKey(dayDate);
                const isToday = key === todayKey;
                const isPast = key < todayKey;
                const items = taskMap[key] || [];
                const events = calEventMap[key] || [];
                const count = items.length + events.length;
                const dayLabel = dayDate.toLocaleDateString("en-ZA", { weekday: "long" });
                const dateLabel = dayDate.toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                });

                return (
                  <WeekDayCard key={key} isToday={isToday} isPast={isPast}>
                    <WeekDayHeader
                      label={dayLabel}
                      date={dateLabel}
                      count={count}
                      isToday={isToday}
                    />
                    {count > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {events.map((ev) => (
                          <WeekEventCard key={ev.id} ev={ev} />
                        ))}
                        {items.map((entry) => (
                          <WeekItemCard key={`${entry.id}-${key}`}>
                            {renderSwipeableItem({ entry, dateStr: key }, false)}
                          </WeekItemCard>
                        ))}
                      </div>
                    ) : (
                      <p
                        className="f-serif"
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontStyle: "italic",
                          color: "var(--ink-ghost)",
                        }}
                      >
                        Nothing scheduled.
                      </p>
                    )}
                  </WeekDayCard>
                );
              })}

              {todoList.length > 0 && (
                <WeekDayCard>
                  <WeekDayHeader label="Undated" count={todoList.length} accent="var(--ember)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {todoList.map((entry) => (
                      <WeekItemCard key={entry.id}>{renderEntryRow(entry)}</WeekItemCard>
                    ))}
                  </div>
                </WeekDayCard>
              )}

              {completed.length > 0 && (
                <WeekDayCard>
                  <button
                    onClick={() => setShowCompleted((s) => !s)}
                    className="f-sans"
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: 10,
                      background: "transparent",
                      border: 0,
                      padding: 0,
                      marginBottom: showCompleted ? 12 : 0,
                      cursor: "pointer",
                      color: "var(--ink-faint)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                      }}
                    >
                      Completed
                    </span>
                    <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                      {completed.length}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 12 }}>
                      {showCompleted ? "▾" : "▸"}
                    </span>
                  </button>
                  {showCompleted && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {completed.map((entry) => (
                        <WeekItemCard key={entry.id}>{renderEntryRow(entry)}</WeekItemCard>
                      ))}
                    </div>
                  )}
                </WeekDayCard>
              )}

              {total === 0 && completed.length === 0 && (
                <div className="mt-2 flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4" style={{ fontSize: 40, opacity: 0.3 }}>
                    ☑
                  </div>
                  <p
                    className="mb-1 text-lg font-semibold"
                    style={{ fontFamily: "var(--f-sans)", color: "var(--ink)" }}
                  >
                    All clear
                  </p>
                  <p className="max-w-xs text-sm" style={{ color: "var(--ink-faint)" }}>
                    Add todos above, or they'll appear automatically when entries have due dates.
                  </p>
                </div>
              )}
            </div>

            <WeekFab onClick={focusWeekQuickAdd} />

            <style>{`
              .week-day-card:hover { box-shadow: var(--lift-2); }
              .week-item-card:hover { box-shadow: var(--lift-1); transform: translateY(-1px); }
            `}</style>
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
