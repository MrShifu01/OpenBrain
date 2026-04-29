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

import { useState, useMemo, useEffect, useRef } from "react";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import type { Entry } from "../types";
import { type ExternalCalEvent, toDateKey, getPlacements, isDone } from "./todoUtils";
import QuickAdd from "./TodoQuickAdd";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: "entry" | "google" | "microsoft";
  entry?: Entry;
}

interface Props {
  entries: Entry[];
  externalEvents: ExternalCalEvent[];
  brainId?: string;
  onAdded: () => void;
  onUpdate?: (id: string, changes: Partial<Entry>, options?: { silent?: boolean }) => Promise<void>;
  onDelete?: (id: string) => void;
}

type RepeatMode = "none" | "weekly" | "monthly";

const SPECIFIC_DATE_KEYS_FOR_EDITOR = [
  "due_date",
  "event_date",
  "deadline",
  "renewal_date",
  "expiry_date",
  "appointment_date",
  "scheduled_date",
  "match_date",
  "game_date",
  "date",
] as const;

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// ── Helpers ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_ABBRS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Internal todos use the ember accent (adapts per family). External
 *  events use a fixed blue that reads as "from another calendar" across
 *  every family — different enough from ember to be unambiguous. */
function eventSourceColor(source: CalEvent["source"]): string {
  if (source === "entry") return "var(--ember)";
  return "oklch(58% 0.13 248)";
}

function entriesToCalEvents(entries: Entry[], range: { from: string; to: string }): CalEvent[] {
  // getPlacements does the type/done filter (persona, secret, completed) and
  // expands recurrence within the visible-month range. One call per entry,
  // one source of truth — no risk of static + recurring disagreeing.
  const events: CalEvent[] = [];
  for (const e of entries) {
    const placements = getPlacements(e, {
      mode: "calendar",
      range,
      expandRecurrence: true,
    });
    for (const d of placements) {
      const day = parseISO(d);
      events.push({
        id: `entry-${e.id}-${d}`,
        title: e.title,
        start: startOfDay(day),
        end: endOfDay(day),
        allDay: true,
        source: "entry",
        entry: e,
      });
    }
  }
  return events;
}

function externalToCalEvents(exts: ExternalCalEvent[]): CalEvent[] {
  return exts.map((ev) => ({
    id: `ext-${ev.id}`,
    title: ev.title,
    start: new Date(ev.start),
    end: new Date(ev.end),
    allDay: ev.allDay ?? false,
    source: ev.provider,
  }));
}

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const total = new Date(year, month + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7; // Mon = 0
  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: total }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// PrimePro-style helpers — short time + duration + status mapping. Kept
// near formatTime so the date math lives together.
function formatShortTime(d: Date): string {
  // "9 am" / "12 pm" / "1:30 pm" — collapse :00 to bare hour to match
  // the reference design.
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const m = d.getMinutes();
  const period = d.getHours() >= 12 ? "pm" : "am";
  return m === 0 ? `${h12} ${period}` : `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatDuration(start: Date, end: Date): string | null {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = mins / 60;
  // 1 hr / 1.5 hrs / 2 hrs — drop trailing .0 for whole hours.
  const rounded = Math.round(hrs * 2) / 2;
  return rounded === Math.round(rounded)
    ? `${rounded} hr${rounded === 1 ? "" : "s"}`
    : `${rounded} hrs`;
}

function deriveEventStatus(event: CalEvent): { label: string; color: string } {
  if (event.source !== "entry" || !event.entry) {
    return {
      label:
        event.source === "google" ? "Google" : event.source === "microsoft" ? "Outlook" : "Event",
      color: "oklch(54% 0.13 248)",
    };
  }
  const entry = event.entry;
  if (isDone(entry)) return { label: "Done", color: "var(--moss, oklch(56% 0.12 145))" };
  const eventDay = startOfDay(event.start);
  const today = startOfDay(new Date());
  if (eventDay.getTime() < today.getTime()) {
    return { label: "Overdue", color: "var(--danger, var(--blood, oklch(58% 0.18 25)))" };
  }
  if (eventDay.getTime() === today.getTime()) {
    return { label: "Due today", color: "var(--ember)" };
  }
  return { label: "Scheduled", color: "var(--ink-soft)" };
}

function deriveSubtitle(event: CalEvent): string | null {
  if (event.source !== "entry" || !event.entry) {
    return event.source === "google"
      ? "Google Calendar"
      : event.source === "microsoft"
        ? "Outlook Calendar"
        : null;
  }
  const entry = event.entry;
  const parts: string[] = [];
  if (entry.type) parts.push(entry.type);
  if (entry.tags && entry.tags.length > 0) parts.push(entry.tags.slice(0, 2).join(", "));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function useIsDesktop(breakpoint = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth >= breakpoint,
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isDesktop;
}

// ── Sub-components ────────────────────────────────────────────────────────

function ChevronButton({
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
        border: 0,
        background: "transparent",
        color: "var(--ink-soft)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 180ms",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-high)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <svg
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={direction === "left" ? "M15.75 19.5L8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"}
        />
      </svg>
    </button>
  );
}

function CalendarHeader({
  title,
  onPrev,
  onNext,
  onToday,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <ChevronButton direction="left" onClick={onPrev} ariaLabel="Previous" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <h2
          className="f-serif"
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            margin: 0,
            textAlign: "center",
          }}
        >
          {title}
        </h2>
        <Button
          size="xs"
          variant="ghost"
          onClick={onToday}
          className="rounded-full bg-[var(--ember-wash)] text-[var(--ember)]"
        >
          Today
        </Button>
      </div>
      <ChevronButton direction="right" onClick={onNext} ariaLabel="Next" />
    </div>
  );
}

// Two-row "Tetris" stacking — top-heavy. Reads cleaner in a narrow day cell
// than a long horizontal row when there are 3+ events:
//   1 → •
//   2 → • •
//   3 → • •  /  •
//   4 → • •  /  • •
//   5 → • • •  /  • •
//   6 → • • •  /  • • •
//   7+ → 6 dots + +N
function EventDots({ events }: { events: CalEvent[] }) {
  if (events.length === 0) return null;
  const MAX = 6;
  const visible = events.slice(0, MAX);
  const overflow = events.length - visible.length;
  // Top row gets the extra dot when count is odd (top-heavy looks like a
  // proper Tetris piece resting; bottom-heavy reads as off-balance).
  const topCount = Math.ceil(visible.length / 2);
  const top = visible.slice(0, topCount);
  const bottom = visible.slice(topCount);

  const dotStyle = (ev: CalEvent): React.CSSProperties => ({
    width: 5,
    height: 5,
    borderRadius: 999,
    background: eventSourceColor(ev.source),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {top.map((ev, i) => (
          <span key={`t${i}`} aria-hidden="true" style={dotStyle(ev)} />
        ))}
      </div>
      {bottom.length > 0 && (
        <div style={{ display: "flex", gap: 3 }}>
          {bottom.map((ev, i) => (
            <span key={`b${i}`} aria-hidden="true" style={dotStyle(ev)} />
          ))}
        </div>
      )}
      {overflow > 0 && (
        <span
          aria-hidden="true"
          style={{ fontSize: 9, color: "var(--ink-ghost)", lineHeight: 1, marginTop: 1 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

function DayCell({
  date,
  events,
  isToday,
  isSelected,
  onClick,
}: {
  date: Date | null;
  events: CalEvent[];
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  if (!date) {
    return (
      <div
        aria-hidden="true"
        className="cal-day-empty"
        style={{
          minHeight: 78,
          background: "var(--surface-low)",
        }}
      />
    );
  }
  return (
    <button
      onClick={onClick}
      className="cal-day press"
      data-today={isToday || undefined}
      data-selected={isSelected || undefined}
      style={{
        minHeight: 78,
        padding: "8px 6px 6px",
        background: isSelected ? "var(--ember-wash)" : "var(--surface)",
        border: 0,
        textAlign: "center",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        transition: "background 160ms ease",
        font: "inherit",
        color: "inherit",
      }}
    >
      <span
        className="f-sans"
        style={{
          width: 26,
          height: 26,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: isToday ? 700 : 500,
          color: isToday ? "var(--ember-ink)" : isSelected ? "var(--ember)" : "var(--ink)",
          background: isToday ? "var(--ember)" : "transparent",
          borderRadius: 999,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {date.getDate()}
      </span>
      <div style={{ flex: 1 }} />
      <EventDots events={events} />
    </button>
  );
}

function EventCard({
  event,
  onUpdate,
  onDelete,
}: {
  event: CalEvent;
  onUpdate?: Props["onUpdate"];
  onDelete?: Props["onDelete"];
}) {
  const editable = event.source === "entry" && !!event.entry;
  const [editing, setEditing] = useState(false);

  if (editing && event.entry) {
    return (
      <EventEditor
        entry={event.entry}
        defaultDateKey={toDateKey(event.start)}
        onSave={async (changes) => {
          if (onUpdate && event.entry) await onUpdate(event.entry.id, changes);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        onDelete={
          onDelete && event.entry
            ? () => {
                onDelete(event.entry!.id);
                setEditing(false);
              }
            : undefined
        }
      />
    );
  }

  const status = deriveEventStatus(event);
  const timeLabel = event.allDay ? "All day" : formatShortTime(event.start);
  const durationLabel = event.allDay ? null : formatDuration(event.start, event.end);
  const subtitle = deriveSubtitle(event);
  const initial = (event.entry?.type || event.source).charAt(0).toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "stretch",
      }}
    >
      {/* Left time column — outside the card, PrimePro-style */}
      <div
        className="f-sans"
        style={{
          width: 56,
          flexShrink: 0,
          paddingTop: 14,
          textAlign: "right",
          color: "var(--ink-soft)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.1, color: "var(--ink)" }}>
          {timeLabel}
        </div>
        {durationLabel && (
          <div style={{ fontSize: 11, marginTop: 3, color: "var(--ink-ghost)" }}>
            {durationLabel}
          </div>
        )}
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={editable ? () => setEditing(true) : undefined}
        disabled={!editable}
        aria-label={editable ? `Open ${event.title}` : event.title}
        className={editable ? "press" : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 14,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          cursor: editable ? "pointer" : "default",
          font: "inherit",
          color: "inherit",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: status.color,
            }}
          >
            {status.label}
          </span>
          {editable && (
            <span
              aria-hidden="true"
              style={{
                color: "var(--ink-ghost)",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
          )}
        </div>
        <div
          className="f-sans"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {event.title}
        </div>
        {subtitle && (
          <div
            className="f-sans"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
              paddingTop: 8,
              borderTop: "1px solid var(--line-soft)",
              fontSize: 12,
              color: "var(--ink-soft)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "var(--surface-high, var(--surface))",
                border: "1px solid var(--line-soft)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "var(--ink-soft)",
                flexShrink: 0,
              }}
            >
              {initial}
            </span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {subtitle}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}

function deriveCurrentDateKey(metadata: Record<string, unknown>): string | null {
  for (const k of SPECIFIC_DATE_KEYS_FOR_EDITOR) {
    const v = metadata[k];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return null;
}

function deriveOriginalDateKeyName(metadata: Record<string, unknown>): string {
  for (const k of SPECIFIC_DATE_KEYS_FOR_EDITOR) {
    if (typeof metadata[k] === "string") return k;
  }
  return "event_date";
}

function deriveCurrentRepeat(metadata: Record<string, unknown>): RepeatMode {
  if (metadata.day_of_month != null && metadata.day_of_month !== "") return "monthly";
  const dow = (metadata.day_of_week ?? metadata.weekday ?? metadata.recurring_day) as
    | string
    | undefined;
  if (typeof dow === "string" && dow.trim()) return "weekly";
  return "none";
}

function EventEditor({
  entry,
  defaultDateKey,
  onSave,
  onCancel,
  onDelete,
}: {
  entry: Entry;
  defaultDateKey: string;
  onSave: (changes: Partial<Entry>) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const meta = (entry.metadata || {}) as Record<string, unknown>;
  const [title, setTitle] = useState(entry.title || "");
  const [dateStr, setDateStr] = useState(deriveCurrentDateKey(meta) ?? defaultDateKey);
  const [repeat, setRepeat] = useState<RepeatMode>(deriveCurrentRepeat(meta));
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const next: Record<string, unknown> = { ...meta };

    // Always reset recurrence + specific-date fields, then set the chosen mode.
    SPECIFIC_DATE_KEYS_FOR_EDITOR.forEach((k) => delete next[k]);
    delete next.day_of_week;
    delete next.weekday;
    delete next.recurring_day;
    delete next.day_of_month;

    const picked = parseISO(dateStr + "T00:00:00");

    if (repeat === "none") {
      const fieldName = deriveOriginalDateKeyName(meta);
      next[fieldName] = dateStr;
    } else if (repeat === "weekly") {
      next.day_of_week = WEEKDAY_NAMES[picked.getDay()];
    } else {
      next.day_of_month = picked.getDate();
    }

    const changes: Partial<Entry> = { metadata: next as Entry["metadata"] };
    if (title.trim() && title !== entry.title) changes.title = title.trim();

    await onSave(changes);
    setSaving(false);
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "var(--f-sans)",
    color: "var(--ink)",
    background: "var(--surface-high)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    outline: "none",
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--ember)",
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="f-sans"
        style={{ ...fieldStyle, fontSize: 14, fontWeight: 500 }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Date
          </span>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            style={fieldStyle}
          />
        </label>
        <label style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Repeat
          </span>
          <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatMode)}>
            <SelectTrigger style={fieldStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — one shot</SelectItem>
              <SelectItem value="weekly">Every week (same weekday)</SelectItem>
              <SelectItem value="monthly">Every month (same day-of-month)</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        {onDelete ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={saving}
            className="border-[color-mix(in_oklch,var(--blood)_35%,transparent)] text-[var(--blood)]"
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DayDetailContent({
  date,
  events,
  onClose,
  onUpdate,
  onDelete,
}: {
  date: Date;
  events: CalEvent[];
  onClose?: () => void;
  onUpdate?: Props["onUpdate"];
  onDelete?: Props["onDelete"];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div>
          <p
            className="f-sans"
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-ghost)",
            }}
          >
            {events.length === 0
              ? "Free"
              : `${events.length} ${events.length === 1 ? "event" : "events"}`}
          </p>
          <h3
            className="f-serif"
            style={{
              margin: "4px 0 0",
              fontSize: 20,
              fontWeight: 500,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {formatDayHeader(date)}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="press"
            style={{
              height: 28,
              width: 28,
              borderRadius: 999,
              border: 0,
              background: "var(--surface-low)",
              color: "var(--ink-soft)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      {events.length === 0 ? (
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidePanel({ children }: { children: React.ReactNode }) {
  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        alignSelf: "flex-start",
        position: "sticky",
        top: 16,
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 16,
        padding: 18,
        boxShadow: "var(--lift-1)",
      }}
    >
      {children}
    </aside>
  );
}

function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Lock body scroll while sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Drag-to-dismiss state. Only triggered from the handle area at the top —
  // otherwise scrolling through the event list would conflict with closing.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const CLOSE_THRESHOLD = 90; // px of downward drag to dismiss

  function onHandleTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0]?.clientY ?? 0;
    setDragging(true);
  }
  function onHandleTouchMove(e: React.TouchEvent) {
    const y = e.touches[0]?.clientY ?? 0;
    const delta = y - startYRef.current;
    setDragY(Math.max(0, delta)); // never drag up
  }
  function onHandleTouchEnd() {
    setDragging(false);
    if (dragY > CLOSE_THRESHOLD) {
      onClose();
      // Reset for next open. The sheet animates closed via animation; the
      // transform jumps back to 0 once `open=false` unmounts.
      setTimeout(() => setDragY(0), 200);
    } else {
      setDragY(0); // snap back
    }
  }

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        animation: "cal-sheet-fade 200ms ease",
      }}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--scrim)",
          border: 0,
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "var(--surface)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          // Bottom padding includes the 56px BottomNav height so the last
          // event card has clearance instead of disappearing under the nav.
          padding: "14px 20px calc(84px + env(safe-area-inset-bottom))",
          boxShadow: "var(--lift-3)",
          maxHeight: "85vh",
          overflowY: "auto",
          animation: dragY > 0 ? undefined : "cal-sheet-slide 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y",
        }}
      >
        {/* Handle: enlarged hit area + touch handlers for drag-to-dismiss. */}
        <div
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchEnd}
          role="button"
          aria-label="Drag down to close"
          tabIndex={0}
          style={{
            // Generous hit area around the visible bar so it's easy to grab.
            margin: "-14px -20px 4px",
            padding: "12px 20px 8px",
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 40,
              height: 4,
              background: "var(--line)",
              borderRadius: 2,
              margin: "0 auto",
            }}
          />
        </div>
        {children}
      </div>
    </div>
  );
}

function FloatingActionButton({ onClick }: { onClick: () => void }) {
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

// ── View bodies ───────────────────────────────────────────────────────────

function MonthGrid({
  navDate,
  selectedKey,
  todayKey,
  eventMap,
  onSelect,
}: {
  navDate: Date;
  selectedKey: string | null;
  todayKey: string;
  eventMap: Record<string, CalEvent[]>;
  onSelect: (key: string) => void;
}) {
  const grid = useMemo(() => buildMonthGrid(navDate.getFullYear(), navDate.getMonth()), [navDate]);
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          marginBottom: 8,
        }}
      >
        {DAY_ABBRS.map((d) => (
          <div
            key={d}
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-ghost)",
              textAlign: "center",
              padding: "4px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="cal-grid-frame"
        style={{
          border: "1px solid var(--line-soft)",
          borderRadius: 14,
          overflow: "hidden",
          background: "var(--line-soft)",
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 1,
        }}
      >
        {grid.flat().map((day, i) => {
          if (!day)
            return (
              <DayCell
                key={`empty-${i}`}
                date={null}
                events={[]}
                isToday={false}
                isSelected={false}
                onClick={() => {}}
              />
            );
          const key = toDateKey(day);
          return (
            <DayCell
              key={key}
              date={day}
              events={eventMap[key] || []}
              isToday={key === todayKey}
              isSelected={key === selectedKey}
              onClick={() => onSelect(key)}
            />
          );
        })}
      </div>
    </div>
  );
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
  onUpdate?: Props["onUpdate"];
  onDelete?: Props["onDelete"];
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
