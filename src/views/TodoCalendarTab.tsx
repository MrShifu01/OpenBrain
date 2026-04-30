// ============================================================
// Calendar (used by Todos → Calendar tab)
// ============================================================
//
// Premium iOS-inspired calendar that adapts to all three design families
// (dusk / paper / bronze) × both modes via CSS tokens. The spec's hard-coded
// "gold" palette is implemented through --ember + --ember-wash so colour
// shifts follow whichever family/mode is active.
//
// Three views: My Day (today + upcoming agenda), Week (7-column day strip),
// Calendar (month grid). Selected day surfaces in a right-side panel on
// desktop and a bottom sheet on mobile.
//
// Sub-components live in sibling files:
//   - todoCalendarHelpers.ts  → types, constants, pure helpers, useIsDesktop
//   - TodoCalendarChrome.tsx  → header, dots, day cell, month grid, panel, sheet, FAB
//   - TodoCalendarEvent.tsx   → EventCard, EventEditor, DayDetailContent

import { useMemo, useRef, useState } from "react";
import { parseISO } from "date-fns";
import type { Entry } from "../types";
import { type ExternalCalEvent, toDateKey } from "./todoUtils";
import QuickAdd from "./TodoQuickAdd";
import {
  type CalEvent,
  type EventDeleteHandler,
  type EventUpdateHandler,
  DAY_ABBRS,
  MONTH_NAMES,
  entriesToCalEvents,
  externalToCalEvents,
  useIsDesktop,
} from "./todoCalendarHelpers";
import {
  BottomSheet,
  CalendarHeader,
  FloatingActionButton,
  MonthGrid,
  SidePanel,
} from "./TodoCalendarChrome";
import { DayDetailContent, EventCard } from "./TodoCalendarEvent";

interface Props {
  entries: Entry[];
  externalEvents: ExternalCalEvent[];
  brainId?: string;
  onAdded: () => void;
  onUpdate?: EventUpdateHandler;
  onDelete?: EventDeleteHandler;
}

// ── Main component ────────────────────────────────────────────────────────

export default function TodoCalendarTab({
  entries,
  externalEvents,
  brainId,
  onAdded,
  onUpdate,
  onDelete,
}: Props) {
  const [navDate, setNavDate] = useState(new Date());
  const todayKey = toDateKey(new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(todayKey);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDesktop = useIsDesktop(1024);
  const quickAddRef = useRef<HTMLDivElement | null>(null);

  const year = navDate.getFullYear();
  const month = navDate.getMonth();

  // Recurrence is expanded within the visible month; navigating to a new
  // month rebuilds calEvents. Wider buffer (±1 day) covers Sunday-of-previous
  // and Saturday-of-next that appear at the grid edges.
  const visibleRange = useMemo(() => {
    const first = new Date(year, month, 1);
    first.setDate(first.getDate() - 1);
    const last = new Date(year, month + 1, 0);
    last.setDate(last.getDate() + 1);
    return { from: toDateKey(first), to: toDateKey(last) };
  }, [year, month]);

  // Build the event map once per inputs. entriesToCalEvents now expands
  // recurrence + filters persona/secret/done — no second addRecurring pass.
  const calEvents = useMemo(
    () => [...entriesToCalEvents(entries, visibleRange), ...externalToCalEvents(externalEvents)],
    [entries, externalEvents, visibleRange],
  );

  const eventMap = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    calEvents.forEach((ev) => {
      const key = toDateKey(ev.start);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [calEvents]);

  const selectedEvents = selectedKey ? eventMap[selectedKey] || [] : [];

  const handlePrev = () => setNavDate(new Date(year, month - 1, 1));
  const handleNext = () => setNavDate(new Date(year, month + 1, 1));
  const handleToday = () => {
    const today = new Date();
    setNavDate(today);
    setSelectedKey(todayKey);
  };

  const headerTitle = `${MONTH_NAMES[month]} ${year}`;

  const handleSelect = (key: string) => {
    setSelectedKey(key);
    if (!isDesktop) setSheetOpen(true);
  };

  const handleAddClick = () => {
    quickAddRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Focus the first input inside QuickAdd if one exists.
    const input = quickAddRef.current?.querySelector("input, textarea") as HTMLElement | null;
    setTimeout(() => input?.focus(), 250);
  };

  // ── Render ──
  return (
    <div
      className="cal-root"
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div ref={quickAddRef}>
        <QuickAdd brainId={brainId} onAdded={onAdded} />
      </div>

      {externalEvents.length === 0 && (
        <p
          className="f-sans"
          style={{
            fontSize: 11,
            color: "var(--ink-ghost)",
            margin: 0,
          }}
        >
          Connect Google or Outlook in{" "}
          <strong style={{ color: "var(--ink-soft)", fontWeight: 600 }}>
            Settings → Calendar Sync
          </strong>{" "}
          to see your events here.
        </p>
      )}

      <CalendarHeader
        title={headerTitle}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />

      <div className="cal-body">
        <div className="cal-main">
          <MonthGrid
            navDate={navDate}
            selectedKey={selectedKey}
            todayKey={todayKey}
            eventMap={eventMap}
            onSelect={handleSelect}
          />
        </div>

        {isDesktop && selectedKey && (
          <SidePanel>
            <DayDetailContent
              date={parseISO(selectedKey + "T00:00:00")}
              events={selectedEvents}
              onClose={() => setSelectedKey(null)}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          </SidePanel>
        )}
      </div>

      {!isDesktop && (
        <BottomSheet open={sheetOpen && !!selectedKey} onClose={() => setSheetOpen(false)}>
          {selectedKey && (
            <DayDetailContent
              date={parseISO(selectedKey + "T00:00:00")}
              events={selectedEvents}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          )}
        </BottomSheet>
      )}

      <FloatingActionButton onClick={handleAddClick} />

      <style>{`
        .cal-day:hover {
          background: color-mix(in oklch, var(--surface) 88%, var(--ember) 12%);
        }
        .cal-day[data-selected]:hover {
          background: var(--ember-wash);
        }
        .cal-day:focus-visible {
          outline: 2px solid var(--ember);
          outline-offset: -2px;
        }
        .cal-body {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .cal-main {
          flex: 1;
          min-width: 0;
        }
        @keyframes cal-sheet-slide {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes cal-sheet-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (max-width: 1023px) {
          .cal-body { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

// ── Reusable agenda + week-strip exports ─────────────────────────────────
//
// Surfaces the same PrimePro-styled day agenda used by the Month tab's
// drawer to other parts of the schedule (Day tab, Week tab) without
// duplicating event-conversion logic. Callers pass raw `entries` +
// `externalEvents`; we filter to the single day inside the wrapper so
// each tab body stays a thin compositor.

export function DayAgenda({
  date,
  entries,
  externalEvents,
  onUpdate,
  onDelete,
  showHeader = true,
}: {
  date: Date;
  entries: Entry[];
  externalEvents: ExternalCalEvent[];
  onUpdate?: EventUpdateHandler;
  onDelete?: EventDeleteHandler;
  /** Hide the "X events" label + date header — callers like the Day tab
   *  render their own page header so this would duplicate it. */
  showHeader?: boolean;
}) {
  const dateKey = toDateKey(date);
  const events = useMemo(() => {
    const range = { from: dateKey, to: dateKey };
    const fromEntries = entriesToCalEvents(entries, range);
    const fromExternal = externalToCalEvents(externalEvents).filter(
      (ev) => toDateKey(ev.start) === dateKey,
    );
    return [...fromEntries, ...fromExternal].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [dateKey, entries, externalEvents]);

  if (!showHeader) {
    if (events.length === 0) {
      return (
        <p
          className="f-serif"
          style={{
            margin: 0,
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--ink-ghost)",
            padding: "12px 0",
          }}
        >
          Nothing scheduled.
        </p>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {events.map((ev) => (
          <EventCard key={ev.id} event={ev} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    );
  }
  return <DayDetailContent date={date} events={events} onUpdate={onUpdate} onDelete={onDelete} />;
}

// 7-day horizontal day picker. Monday-first; ember wash on selected day.
// Shared by the Week tab. Single-letter day labels match the screenshot.

export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = out.getDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + offset);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function WeekStrip({
  weekStart,
  selectedDate,
  entries,
  externalEvents,
  onSelect,
}: {
  weekStart: Date;
  selectedDate: Date;
  entries: Entry[];
  externalEvents: ExternalCalEvent[];
  onSelect: (date: Date) => void;
}) {
  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Lightweight "has anything?" map for the activity dot; uses a wide-enough
  // range covering this week so recurrence expansion is correct.
  const eventMap = useMemo(() => {
    const last = new Date(weekStart);
    last.setDate(last.getDate() + 6);
    const range = { from: toDateKey(weekStart), to: toDateKey(last) };
    const fromEntries = entriesToCalEvents(entries, range);
    const fromExternal = externalToCalEvents(externalEvents);
    const map: Record<string, number> = {};
    for (const ev of [...fromEntries, ...fromExternal]) {
      const key = toDateKey(ev.start);
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [weekStart, entries, externalEvents]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: 4,
        padding: "10px 6px",
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 14,
      }}
    >
      {days.map((d) => {
        const key = toDateKey(d);
        const isSelected = key === selectedKey;
        const isToday = key === todayKey;
        const dotCount = eventMap[key] || 0;
        return (
          <button
            key={key}
            onClick={() => onSelect(d)}
            className="press"
            aria-pressed={isSelected}
            aria-label={d.toLocaleDateString("en-ZA", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "10px 0 8px",
              border: 0,
              borderRadius: 12,
              background: isSelected ? "var(--ember-wash)" : "transparent",
              color: isSelected ? "var(--ember)" : "var(--ink)",
              cursor: "pointer",
              fontFamily: "var(--f-sans)",
              transition: "background 160ms",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                opacity: isSelected ? 0.8 : 0.55,
              }}
            >
              {DAY_ABBRS[(d.getDay() + 6) % 7].charAt(0)}
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: isSelected || isToday ? 600 : 500,
                lineHeight: 1,
              }}
            >
              {d.getDate()}
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 4,
                height: 4,
                borderRadius: 999,
                marginTop: 2,
                background: dotCount > 0 ? "var(--ember)" : "transparent",
                opacity: isSelected ? 1 : 0.7,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
