import type { Entry } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Schedule placement — single source of truth.
//
// Every "where does this entry appear?" question in the Schedule UI flows
// through `getPlacements(entry, options)`. Calendar grid, My Day list, Week
// view, overdue scan, "undated todos" bucket — all of them.
//
// Why the unification:
//   Before, three functions answered slightly different questions:
//   - extractDates       (calendar grid)   17 metadata keys + content regex
//   - extractActionDates (My Day, Week)    only due_date + deadline
//   - addRecurring       (both)            day_of_week / day_of_month + content regex
//   They disagreed. Entries showed in some views and not others. The content
//   regex caught false positives (any "2026-04-28" string inside content text
//   landed the entry on that day).
//
// What stays vs what changed in this refactor:
//   - STAYS: explicit metadata-key date placement, day_of_week / day_of_month
//     recurrence, the "specific date wins over recurrence" rule.
//   - CHANGED: content-regex date scanning is GONE. If you want an entry on
//     a calendar day, set metadata.due_date / event_date / deadline, OR mark
//     it recurring via day_of_week / day_of_month. Hidden inline dates inside
//     content are NOT auto-placed any more — too many false positives.
//   - NEW: metadata.scheduled_for is recognised as the canonical action date
//     (alongside due_date / deadline). Phase 2 makes scheduled_for primary.
// ─────────────────────────────────────────────────────────────────────────────

/* ─── Date constants ─── */

// Date keys that surface an entry on the calendar grid.
const CALENDAR_DATE_KEYS = [
  "scheduled_for",
  "deadline",
  "due_date",
  "valid_to",
  "valid_from",
  "date",
  "event_date",
  "start_date",
  "end_date",
  "match_date",
  "game_date",
  "scheduled_date",
  "appointment_date",
  "event_start",
  "expiry_date",
  "expiry",
  "renewal_date",
];

// Date keys that mark an entry as actionable (My Day / Week / overdue).
// Narrower than the calendar set: a passport's expiry doesn't belong on My Day.
const ACTION_DATE_KEYS = ["scheduled_for", "due_date", "deadline"];

// Bookkeeping timestamps that look like dates but aren't calendar-relevant.
// Without this exclusion, the broad metadata walk would drag persona facts'
// last_referenced_at onto the day they were last touched.
const NON_CALENDAR_DATE_KEYS = new Set([
  "last_referenced_at",
  "last_decayed_at",
  "retired_at",
  "created_at",
  "updated_at",
  "embedded_at",
  "deleted_at",
  "backfilled_at",
  "user_edited_at",
]);

// Specific-date keys: presence of any of these means the entry has a
// concrete one-shot date. Recurrence expansion bails when one is set, so we
// don't fabricate every Wednesday on top of "Wednesday 1 May" specifically.
const SPECIFIC_DATE_KEYS = [
  "scheduled_for",
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
];

// Entry types that NEVER appear in the schedule UI regardless of metadata.
const NON_SCHEDULABLE_TYPES = new Set(["secret", "persona"]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const DOW: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/* ─── Public types ─── */

export interface PlacementOptions {
  /** "actions" = narrow placement (My Day / Week / overdue scan).
   *  "calendar" = wide placement (Calendar grid). Defaults to "calendar". */
  mode?: "actions" | "calendar";
  /** Restrict output to YYYY-MM-DD dates within [from, to] inclusive.
   *  Required if expandRecurrence is true (recurrence has no natural bound). */
  range?: { from: string; to: string };
  /** Generate recurring instances within range. Off by default — callers that
   *  want "this entry's specific dates" pass false; callers that want
   *  "every day this entry should appear in this month" pass true. */
  expandRecurrence?: boolean;
  /** Include entries whose metadata.status is "done". Default false. */
  includeCompleted?: boolean;
}

export interface TodoItem {
  entry: Entry;
  dateStr: string;
}

export interface ExternalCalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay?: boolean;
  provider: "google" | "microsoft";
  calendarEmail?: string;
}

/* ─── Public helpers ─── */

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isDone(entry: Entry): boolean {
  return (entry.metadata as { status?: string } | undefined)?.status === "done";
}

/* ─── The single placement function ─── */

export function getPlacements(entry: Entry, options: PlacementOptions = {}): string[] {
  const { mode = "calendar", range, expandRecurrence = false, includeCompleted = false } = options;

  if (!includeCompleted && isDone(entry)) return [];
  if (NON_SCHEDULABLE_TYPES.has(entry.type)) return [];

  const dates = new Set<string>();
  const m = (entry.metadata || {}) as Record<string, unknown>;

  // ── Explicit dates from known metadata keys ───────────────────────────
  const keys = mode === "actions" ? ACTION_DATE_KEYS : CALENDAR_DATE_KEYS;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "string" && DATE_RE.test(v)) dates.add(v.slice(0, 10));
  }

  // ── Calendar mode: also pick up unknown date-shaped string values ─────
  // Lets uncommon-but-explicit metadata.foo_date keys still surface, while
  // ignoring bookkeeping timestamps. NOT a content-regex scan — only
  // metadata fields, only top-level, only string values.
  if (mode === "calendar") {
    for (const [k, v] of Object.entries(m)) {
      if (NON_CALENDAR_DATE_KEYS.has(k)) continue;
      if (typeof v === "string" && DATE_RE.test(v)) dates.add(v.slice(0, 10));
    }
  }

  // ── Recurrence expansion ──────────────────────────────────────────────
  if (expandRecurrence) {
    if (!range) {
      throw new Error("getPlacements: expandRecurrence requires a range");
    }
    if (!hasSpecificDate(m)) {
      expandRecurringDates(entry, range, (key) => dates.add(key));
    }
  }

  // ── Range clamp ──────────────────────────────────────────────────────
  let result = [...dates];
  if (range) {
    result = result.filter((d) => d >= range.from && d <= range.to);
  }
  result.sort();
  return result;
}

/* ─── Convenience wrappers ─── */

/** Action placements — for My Day, Week, overdue. No recurrence expansion. */
export function getActionPlacements(entry: Entry): string[] {
  return getPlacements(entry, { mode: "actions" });
}

/* ─── Debug inspector (Phase 5) ─── */

export interface PlacementExplanation {
  /** Final placements — what the engine actually returns. */
  dates: string[];
  /** Why the engine returned each date, OR why it returned nothing. One line
   *  per signal (metadata key, recurrence rule, exclusion). Read top to
   *  bottom for a play-by-play of how the placement was decided. */
  trace: string[];
  /** True if the entry is excluded entirely — the trace explains why. */
  excluded: boolean;
}

/**
 * Returns the same dates as getPlacements PLUS a human-readable trace of
 * which signals contributed and which exclusions fired. Used by the admin
 * "Why isn't X showing?" inspector — never call from production paths.
 */
export function explainPlacements(
  entry: Entry,
  options: PlacementOptions = {},
): PlacementExplanation {
  const { mode = "calendar", range, expandRecurrence = false, includeCompleted = false } = options;
  const trace: string[] = [];

  if (!includeCompleted && isDone(entry)) {
    return {
      dates: [],
      trace: ['Excluded: metadata.status === "done" (set includeCompleted=true to override)'],
      excluded: true,
    };
  }
  if (NON_SCHEDULABLE_TYPES.has(entry.type)) {
    return {
      dates: [],
      trace: [`Excluded: type="${entry.type}" is never schedulable`],
      excluded: true,
    };
  }

  const dates = new Set<string>();
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const keys = mode === "actions" ? ACTION_DATE_KEYS : CALENDAR_DATE_KEYS;
  trace.push(`Mode: ${mode} (checking keys: ${keys.join(", ")})`);

  for (const k of keys) {
    const v = m[k];
    if (typeof v === "string" && DATE_RE.test(v)) {
      const d = v.slice(0, 10);
      dates.add(d);
      trace.push(`+ ${d} from metadata.${k}`);
    }
  }

  if (mode === "calendar") {
    for (const [k, v] of Object.entries(m)) {
      if (NON_CALENDAR_DATE_KEYS.has(k)) continue;
      if (keys.includes(k)) continue;
      if (typeof v === "string" && DATE_RE.test(v)) {
        const d = v.slice(0, 10);
        dates.add(d);
        trace.push(`+ ${d} from metadata.${k} (open scan)`);
      }
    }
  }

  if (expandRecurrence) {
    if (!range) {
      trace.push("! Recurrence skipped: no range supplied");
    } else if (hasSpecificDate(m)) {
      const specific = SPECIFIC_DATE_KEYS.filter((k) => {
        const v = m[k];
        return typeof v === "string" && DATE_RE.test(v);
      });
      trace.push(`Recurrence skipped: specific date set (${specific.join(", ")})`);
    } else {
      const before = dates.size;
      const recurringKeys: string[] = [];
      expandRecurringDates(entry, range, (key) => {
        if (!dates.has(key)) recurringKeys.push(key);
        dates.add(key);
      });
      const added = dates.size - before;
      if (added === 0) {
        trace.push("Recurrence: no rule detected (no day_of_week / day_of_month / recurrence)");
      } else {
        trace.push(
          `+ ${added} recurring date(s): ${recurringKeys.slice(0, 5).join(", ")}${recurringKeys.length > 5 ? ` +${recurringKeys.length - 5} more` : ""}`,
        );
      }
    }
  }

  let result = [...dates];
  if (range) {
    const before = result.length;
    result = result.filter((d) => d >= range.from && d <= range.to);
    if (result.length < before) {
      trace.push(
        `- ${before - result.length} date(s) trimmed by range [${range.from} → ${range.to}]`,
      );
    }
  }
  result.sort();

  if (result.length === 0) {
    trace.push("Result: no placements (entry will not appear)");
  } else {
    trace.push(`Result: ${result.length} placement(s)`);
  }

  return { dates: result, trace, excluded: false };
}

/** Calendar placements within a month. Recurrence expanded. */
export function getCalendarPlacements(entry: Entry, range: { from: string; to: string }): string[] {
  return getPlacements(entry, {
    mode: "calendar",
    range,
    expandRecurrence: true,
  });
}

/* ─── Internal helpers ─── */

function hasSpecificDate(metadata: Record<string, unknown>): boolean {
  return SPECIFIC_DATE_KEYS.some((key) => {
    const v = metadata[key];
    return typeof v === "string" && DATE_RE.test(v);
  });
}

function dateKey(year: number, mon: number, day: number): string {
  return `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

/** Iterate every YYYY-MM-DD between from and to inclusive, calling visit. */
function eachDayInRange(
  from: string,
  to: string,
  visit: (year: number, mon: number, day: number, dow: number) => void,
): void {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (!start || !end) return;
  const cursor = new Date(start.y, start.m, start.d);
  const stop = new Date(end.y, end.m, end.d);
  while (cursor.getTime() <= stop.getTime()) {
    visit(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), cursor.getDay());
    cursor.setDate(cursor.getDate() + 1);
  }
}

/* ─── Recurrence parsing ─── */

/**
 * Phase 2 canonical recurrence shape. Stored at metadata.recurrence.
 * Engine reads the canonical shape FIRST; if absent, falls back to legacy
 * day_of_week / day_of_month + content scanning so existing entries keep
 * working until backfill catches up.
 */
export interface Recurrence {
  freq: "weekly" | "monthly";
  /** Weekly: 0-indexed day-of-week (0 = Sunday). Multiple days allowed. */
  dow?: number[];
  /** Monthly: day-of-month 1-31. Multiple days allowed. */
  dom?: number[];
}

interface ParsedRecurrence {
  dows: Set<number>;
  doms: Set<number>;
}

function parseRecurrence(entry: Entry): ParsedRecurrence | null {
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const dows = new Set<number>();
  const doms = new Set<number>();

  // Canonical recurrence object (Phase 2 forward).
  const rec = m.recurrence as Recurrence | null | undefined;
  if (rec && typeof rec === "object") {
    if (Array.isArray(rec.dow)) {
      for (const d of rec.dow) if (typeof d === "number" && d >= 0 && d <= 6) dows.add(d);
    }
    if (Array.isArray(rec.dom)) {
      for (const d of rec.dom) if (typeof d === "number" && d >= 1 && d <= 31) doms.add(d);
    }
  }

  // Legacy day_of_week (string).
  const rawDay = ((m.day_of_week || m.weekday || m.recurring_day || "") as string)
    .toString()
    .toLowerCase()
    .trim();
  if (rawDay && DOW[rawDay] !== undefined) dows.add(DOW[rawDay]);

  // Legacy day_of_month (string or number).
  const domRaw = m.day_of_month;
  if (domRaw !== undefined && domRaw !== null && domRaw !== "") {
    const n = parseInt(String(domRaw), 10);
    if (!isNaN(n) && n >= 1 && n <= 31) doms.add(n);
  }

  // Content fallback — only applied when no metadata recurrence at all.
  // Lets pure-content "every Friday" notes still recur, but doesn't fire when
  // the user has explicitly set the metadata (avoids double-extraction).
  if (dows.size === 0 && doms.size === 0) {
    const text = `${entry.title || ""} ${entry.content || ""}`;
    const dowMatch = text.match(
      /every\s+(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)/i,
    );
    if (dowMatch) {
      const key = dowMatch[1].toLowerCase();
      if (DOW[key] !== undefined) dows.add(DOW[key]);
    }
    const domMatch = text.match(
      /every\s+(\d+)(?:st|nd|rd|th)(?:\s+of\s+(?:every|the|each)?\s*month)?|(\d+)(?:st|nd|rd|th)\s+of\s+every\s+month/i,
    );
    if (domMatch) {
      const n = parseInt(domMatch[1] ?? domMatch[2], 10);
      if (!isNaN(n) && n >= 1 && n <= 31) doms.add(n);
    }
  }

  if (dows.size === 0 && doms.size === 0) return null;
  return { dows, doms };
}

/** Generate recurring date keys for an entry within range. */
function expandRecurringDates(
  entry: Entry,
  range: { from: string; to: string },
  onDate: (key: string) => void,
): void {
  const parsed = parseRecurrence(entry);
  if (!parsed) return;

  eachDayInRange(range.from, range.to, (year, mon, day, dow) => {
    if (parsed.doms.size > 0) {
      const lastDay = new Date(year, mon + 1, 0).getDate();
      for (const dom of parsed.doms) {
        if (day === Math.min(dom, lastDay)) {
          onDate(dateKey(year, mon, day));
          return;
        }
      }
    }
    if (parsed.dows.has(dow)) {
      onDate(dateKey(year, mon, day));
    }
  });
}

/* ─── Deprecated wrappers ─── */
//
// Kept for backwards compatibility while call sites migrate. Each one is a
// thin shim around getPlacements with the legacy semantics. Phase 2 will
// remove these in favour of getPlacements / getCalendarPlacements.

/**
 * @deprecated Use getPlacements(entry, { mode: "calendar" }) instead.
 *  Note: this no longer scans content for date-shaped strings — only
 *  metadata keys. Callers that depended on the regex must surface dates
 *  explicitly via metadata.scheduled_for / due_date / event_date.
 */
export function extractDates(entry: Entry): string[] {
  return getPlacements(entry, { mode: "calendar", includeCompleted: true });
}

/**
 * @deprecated Use getActionPlacements(entry) instead.
 */
export function extractActionDates(entry: Entry): string[] {
  return getPlacements(entry, { mode: "actions", includeCompleted: true });
}

/**
 * @deprecated Use getCalendarPlacements(entry, { from, to }) instead.
 *  Legacy signature: mutates a map via the `add` callback for every recurring
 *  date in the target month. New code should use the unified function which
 *  returns an array, not a callback.
 */
export function addRecurring(
  entries: Entry[],
  add: (key: string, e: Entry) => void,
  targetYear?: number,
  targetMon?: number,
): void {
  const now = new Date();
  const year = targetYear ?? now.getFullYear();
  const mon = targetMon ?? now.getMonth();
  const lastDay = new Date(year, mon + 1, 0).getDate();
  const range = { from: dateKey(year, mon, 1), to: dateKey(year, mon, lastDay) };
  for (const e of entries) {
    if (NON_SCHEDULABLE_TYPES.has(e.type)) continue;
    if (hasSpecificDate((e.metadata || {}) as Record<string, unknown>)) continue;
    expandRecurringDates(e, range, (key) => add(key, e));
  }
}
