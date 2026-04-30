// Pure helpers + shared types for the calendar tab.
// Split out of TodoCalendarTab.tsx so the orchestrator + subviews can import
// without dragging the full god-file. Date math, recurrence expansion,
// status derivation and the desktop-breakpoint hook all live here.

import { useEffect, useState } from "react";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import type { Entry } from "../types";
import { type ExternalCalEvent, getPlacements, isDone } from "./todoUtils";

// ── Types ─────────────────────────────────────────────────────────────────

export interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: "entry" | "google" | "microsoft";
  entry?: Entry;
}

export type RepeatMode = "none" | "weekly" | "monthly";

export type EventUpdateHandler = (
  id: string,
  changes: Partial<Entry>,
  options?: { silent?: boolean },
) => Promise<void>;

export type EventDeleteHandler = (id: string) => void;

// ── Constants ─────────────────────────────────────────────────────────────

export const SPECIFIC_DATE_KEYS_FOR_EDITOR = [
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

export const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const MONTH_NAMES = [
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

export const DAY_ABBRS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Pure helpers ──────────────────────────────────────────────────────────

/** Internal todos use the ember accent (adapts per family). External
 *  events use a fixed blue that reads as "from another calendar" across
 *  every family — different enough from ember to be unambiguous. */
export function eventSourceColor(source: CalEvent["source"]): string {
  if (source === "entry") return "var(--ember)";
  return "oklch(58% 0.13 248)";
}

export function entriesToCalEvents(
  entries: Entry[],
  range: { from: string; to: string },
): CalEvent[] {
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

export function externalToCalEvents(exts: ExternalCalEvent[]): CalEvent[] {
  return exts.map((ev) => ({
    id: `ext-${ev.id}`,
    title: ev.title,
    start: new Date(ev.start),
    end: new Date(ev.end),
    allDay: ev.allDay ?? false,
    source: ev.provider,
  }));
}

export function buildMonthGrid(year: number, month: number): (Date | null)[][] {
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

export function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// PrimePro-style helpers — short time + duration + status mapping. Kept
// near formatTime so the date math lives together.
export function formatShortTime(d: Date): string {
  // "9 am" / "12 pm" / "1:30 pm" — collapse :00 to bare hour to match
  // the reference design.
  const h12 = ((d.getHours() + 11) % 12) + 1;
  const m = d.getMinutes();
  const period = d.getHours() >= 12 ? "pm" : "am";
  return m === 0 ? `${h12} ${period}` : `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function formatDuration(start: Date, end: Date): string | null {
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

export function deriveEventStatus(event: CalEvent): { label: string; color: string } {
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

export function deriveSubtitle(event: CalEvent): string | null {
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

export function deriveCurrentDateKey(metadata: Record<string, unknown>): string | null {
  for (const k of SPECIFIC_DATE_KEYS_FOR_EDITOR) {
    const v = metadata[k];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return null;
}

export function deriveOriginalDateKeyName(metadata: Record<string, unknown>): string {
  for (const k of SPECIFIC_DATE_KEYS_FOR_EDITOR) {
    if (typeof metadata[k] === "string") return k;
  }
  return "event_date";
}

export function deriveCurrentRepeat(metadata: Record<string, unknown>): RepeatMode {
  if (metadata.day_of_month != null && metadata.day_of_month !== "") return "monthly";
  const dow = (metadata.day_of_week ?? metadata.weekday ?? metadata.recurring_day) as
    | string
    | undefined;
  if (typeof dow === "string" && dow.trim()) return "weekly";
  return "none";
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useIsDesktop(breakpoint = 1024): boolean {
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
