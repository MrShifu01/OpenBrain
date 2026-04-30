import { useState, useMemo, useEffect, useRef } from "react";
import { getKarma } from "../lib/karma";
import { useEntries } from "../context/EntriesContext";
import { authFetch } from "../lib/authFetch";
import type { Entry } from "../types";
import { type ExternalCalEvent, toDateKey, isDone, getActionPlacements } from "./todoUtils";
import TodoQuickAdd from "./TodoQuickAdd";
import TodoCalendarTab, { DayAgenda, WeekStrip, startOfWeek } from "./TodoCalendarTab";
import TodoEditPopover from "./TodoEditPopover";
import TodoRowItem from "./TodoRowItem";
import TodoSomedayTab from "./TodoSomedayTab";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

// ── PrimePro Day/Week pager + banners ─────────────────────────────────────

function PagerChevron({
  direction,
  onClick,
  ariaLabel,
}: {
  direction: "left" | "right";
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="press"
      style={{
        height: 32,
        width: 32,
        borderRadius: 999,
        background: "transparent",
        color: "var(--ink-soft)",
        border: 0,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
      </svg>
    </button>
  );
}

function DayPager({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const todayKey = toDateKey(new Date());
  const isToday = toDateKey(date) === todayKey;
  const label = date.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const prev = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    onChange(d);
  };
  const next = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    onChange(d);
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <PagerChevron direction="left" onClick={prev} ariaLabel="Previous day" />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2
          className="f-serif"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            textAlign: "center",
          }}
        >
          {label}
        </h2>
        {!isToday && (
          <button
            onClick={() => onChange(new Date())}
            className="press f-sans"
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "var(--ember-wash)",
              color: "var(--ember)",
              border: 0,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Today
          </button>
        )}
      </div>
      <PagerChevron direction="right" onClick={next} ariaLabel="Next day" />
    </div>
  );
}

function WeekPager({ weekStart, onChange }: { weekStart: Date; onChange: (d: Date) => void }) {
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const monthLeft = weekStart.toLocaleDateString("en-ZA", { month: "short" });
  const monthRight = weekEnd.toLocaleDateString("en-ZA", { month: "short" });
  const label = sameMonth
    ? `${monthLeft} ${weekStart.getDate()} – ${weekEnd.getDate()}`
    : `${monthLeft} ${weekStart.getDate()} – ${monthRight} ${weekEnd.getDate()}`;
  const prev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    onChange(d);
  };
  const next = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    onChange(d);
  };
  const today = new Date();
  const inThisWeek = today >= weekStart && today <= weekEnd;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <PagerChevron direction="left" onClick={prev} ariaLabel="Previous week" />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2
          className="f-serif"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          {label}
        </h2>
        {!inThisWeek && (
          <button
            onClick={() => onChange(new Date())}
            className="press f-sans"
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "var(--ember-wash)",
              color: "var(--ember)",
              border: 0,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            This week
          </button>
        )}
      </div>
      <PagerChevron direction="right" onClick={next} ariaLabel="Next week" />
    </div>
  );
}

function OverdueBanner({
  count,
  onJump,
  pinned,
}: {
  count: number;
  onJump: () => void;
  pinned?: boolean;
}) {
  return (
    <button
      onClick={onJump}
      className="press"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        marginBottom: 12,
        borderRadius: 12,
        border: "1px solid color-mix(in oklch, var(--blood) 28%, transparent)",
        background: "color-mix(in oklch, var(--blood) 8%, var(--surface))",
        color: "var(--blood)",
        cursor: pinned ? "default" : "pointer",
        font: "inherit",
        textAlign: "left",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--blood)",
          flexShrink: 0,
        }}
      />
      <span
        className="f-sans"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Overdue
      </span>
      <span
        className="f-sans"
        style={{ fontSize: 12, color: "var(--blood)", marginLeft: "auto", fontWeight: 600 }}
      >
        {count} {count === 1 ? "item" : "items"}
        {!pinned && " ›"}
      </span>
    </button>
  );
}

function UndatedSection({
  todos,
  renderRow,
}: {
  todos: Entry[];
  renderRow: (entry: Entry) => React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <div
        className="f-sans"
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
      >
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: 999, background: "var(--ember)" }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ember)",
          }}
        >
          Undated
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-faint)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {todos.length}
        </span>
      </div>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 14,
          padding: "4px 12px",
        }}
        className="divide-y"
      >
        {todos.map((entry) => renderRow(entry))}
      </div>
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
  // Lifted: shared by Day + Week tabs so navigation between them keeps
  // the selected date stable. Defaults to today.
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const weekStartDate = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

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

  // mondayKey is the start of this week; gates overdue filter so anything
  // landing in the current Monday-Sunday range is "this week" not overdue.
  const { mondayKey, todayKey } = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    return { mondayKey: toDateKey(monday), todayKey: toDateKey(now) };
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
            views without leaving the schedule shell. Tabs primitive gives
            arrow-key navigation + ARIA roles for free. */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className={`mb-4 ${somedayEnabled ? "" : "lg:hidden"}`}
        >
          <TabsList
            aria-label="Schedule view"
            className="h-auto w-full overflow-hidden rounded-xl border border-[var(--line-soft)] bg-transparent p-0"
          >
            {TABS.map((t, i) => {
              // Soft "your pile is growing" nudge — only on Someday, only past
              // 20. No number; the count is one tap away. Ember dot on the
              // inactive tab, white dot on the active one (which has an ember
              // background) so it stays visible either way.
              const showDot = typeof t.count === "number" && t.count > 20;
              const active = tab === t.id;
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="relative flex-1 rounded-none border-0 py-2 text-sm font-medium transition-colors data-[state=active]:bg-[var(--ember)] data-[state=active]:text-[var(--ember-ink)] data-[state=active]:shadow-none data-[state=inactive]:bg-[var(--surface)] data-[state=inactive]:text-[var(--ink-soft)]"
                  style={{
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
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

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

        {/* ── Day tab — PrimePro single-day agenda ── */}
        {tab === "today" && (
          <>
            <DayPager date={selectedDate} onChange={setSelectedDate} />

            <div className="mb-4">
              <TodoQuickAdd brainId={activeBrainId} onAdded={() => ctx?.refreshEntries()} />
            </div>

            {overdue.length > 0 && toDateKey(selectedDate) === todayKey && (
              <OverdueBanner count={overdue.length} onJump={() => setTab("list")} />
            )}

            <DayAgenda
              date={selectedDate}
              entries={entries}
              externalEvents={externalEvents}
              onUpdate={ctx?.handleUpdate}
              onDelete={ctx?.handleDelete}
              showHeader={false}
            />

            {todoList.length > 0 && toDateKey(selectedDate) === todayKey && (
              <UndatedSection todos={todoList} renderRow={renderEntryRow} />
            )}
          </>
        )}

        {/* ── Week tab — WeekStrip + PrimePro day agenda ── */}
        {tab === "list" && (
          <>
            <WeekPager weekStart={weekStartDate} onChange={setSelectedDate} />

            <div ref={weekQuickAddRef} className="mb-4">
              <TodoQuickAdd brainId={activeBrainId} onAdded={() => ctx?.refreshEntries()} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <WeekStrip
                weekStart={weekStartDate}
                selectedDate={selectedDate}
                entries={entries}
                externalEvents={externalEvents}
                onSelect={setSelectedDate}
              />
            </div>

            {overdue.length > 0 && (
              <OverdueBanner count={overdue.length} onJump={() => undefined} pinned />
            )}

            <DayAgenda
              date={selectedDate}
              entries={entries}
              externalEvents={externalEvents}
              onUpdate={ctx?.handleUpdate}
              onDelete={ctx?.handleDelete}
            />

            {completed.length > 0 && (
              <div style={{ marginTop: 24 }}>
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
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      background: "var(--surface)",
                      border: "1px solid var(--line-soft)",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    {completed.map((entry) => (
                      <p
                        key={entry.id}
                        className="f-serif"
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "var(--ink-ghost)",
                          textDecoration: "line-through",
                        }}
                      >
                        {entry.title}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
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
