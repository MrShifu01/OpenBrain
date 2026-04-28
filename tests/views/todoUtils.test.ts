import { describe, it, expect } from "vitest";
import {
  addRecurring,
  getPlacements,
  getActionPlacements,
  getCalendarPlacements,
  extractDates,
  extractActionDates,
  isDone,
} from "../../src/views/todoUtils";
import type { Entry } from "../../src/types";

// Phase 1 of the placement-engine refactor:
// All "where does this entry appear?" questions flow through getPlacements.
// Tests here are the contract — if any of these break, an entry will start
// appearing in the wrong day in the Schedule UI.

function entry(metadata: Record<string, unknown>, overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    user_id: "u1",
    brain_id: "b1",
    title: "Test",
    content: "",
    metadata,
    tags: [],
    type: "reminder",
    workspace: "personal",
    created_at: "2026-04-27T10:00:00Z",
    updated_at: "2026-04-27T10:00:00Z",
    ...overrides,
  } as unknown as Entry;
}

const MAY = { from: "2026-05-01", to: "2026-05-31" };

// ─── Action placements (My Day / Week / overdue) ───────────────────────────

describe("getPlacements actions mode", () => {
  it("uses due_date as an action date", () => {
    expect(getPlacements(entry({ due_date: "2026-05-08" }), { mode: "actions" })).toEqual([
      "2026-05-08",
    ]);
  });

  it("uses deadline as an action date", () => {
    expect(getPlacements(entry({ deadline: "2026-05-09" }), { mode: "actions" })).toEqual([
      "2026-05-09",
    ]);
  });

  it("uses scheduled_for as an action date (Phase 2 canonical field)", () => {
    expect(getPlacements(entry({ scheduled_for: "2026-05-10" }), { mode: "actions" })).toEqual([
      "2026-05-10",
    ]);
  });

  it("ignores event_date / expiry_date / valid_to in action mode", () => {
    const m = {
      event_date: "2026-05-01",
      expiry_date: "2026-05-02",
      valid_to: "2026-05-03",
    };
    expect(getPlacements(entry(m), { mode: "actions" })).toEqual([]);
  });

  it("returns multiple sorted dates when several action keys are set", () => {
    const m = { due_date: "2026-05-15", deadline: "2026-05-08", scheduled_for: "2026-05-22" };
    expect(getPlacements(entry(m), { mode: "actions" })).toEqual([
      "2026-05-08",
      "2026-05-15",
      "2026-05-22",
    ]);
  });

  it("dedupes when two action keys hold the same date", () => {
    const m = { due_date: "2026-05-08", deadline: "2026-05-08" };
    expect(getPlacements(entry(m), { mode: "actions" })).toEqual(["2026-05-08"]);
  });

  it("returns empty array for unset metadata", () => {
    expect(getPlacements(entry({}), { mode: "actions" })).toEqual([]);
  });

  it("strips a trailing time component from a date string", () => {
    expect(getPlacements(entry({ due_date: "2026-05-08T14:30:00Z" }), { mode: "actions" })).toEqual(
      ["2026-05-08"],
    );
  });
});

// ─── Calendar placements ───────────────────────────────────────────────────

describe("getPlacements calendar mode", () => {
  it("includes due_date / event_date / expiry_date / deadline", () => {
    const m = {
      due_date: "2026-05-01",
      event_date: "2026-05-08",
      expiry_date: "2026-05-15",
      deadline: "2026-05-22",
    };
    expect(getPlacements(entry(m), { mode: "calendar" })).toEqual([
      "2026-05-01",
      "2026-05-08",
      "2026-05-15",
      "2026-05-22",
    ]);
  });

  it("picks up unknown date-shaped metadata fields", () => {
    expect(getPlacements(entry({ visit_date: "2026-05-08" }), { mode: "calendar" })).toEqual([
      "2026-05-08",
    ]);
  });

  it("excludes bookkeeping timestamps (last_referenced_at, updated_at, etc.)", () => {
    const m = {
      last_referenced_at: "2026-05-01",
      created_at: "2026-04-01",
      updated_at: "2026-04-15",
      deleted_at: "2026-04-30",
      embedded_at: "2026-04-02",
    };
    expect(getPlacements(entry(m), { mode: "calendar" })).toEqual([]);
  });

  it("excludes user_edited_at (Phase 3 marker)", () => {
    const m = { user_edited_at: "2026-05-01", due_date: "2026-05-08" };
    expect(getPlacements(entry(m), { mode: "calendar" })).toEqual(["2026-05-08"]);
  });

  it("does NOT scan title or content for date-shaped strings (false-positive trap)", () => {
    const e = entry({}, { title: "Done 2026-05-15", content: "Migration on 2026-05-22 succeeded" });
    expect(getPlacements(e, { mode: "calendar" })).toEqual([]);
  });

  it("does NOT auto-place the bulk-import false-positive content match", () => {
    const e = entry(
      { source: "launch_checklist_bulk" },
      { content: "Embedding paths done 2026-04-28 (4-attempt exponential backoff)" },
    );
    expect(getPlacements(e, { mode: "calendar" })).toEqual([]);
  });
});

// ─── Range filtering ───────────────────────────────────────────────────────

describe("getPlacements range filter", () => {
  it("excludes dates before range.from", () => {
    const m = { due_date: "2026-04-30", event_date: "2026-05-08" };
    expect(getPlacements(entry(m), { mode: "calendar", range: MAY })).toEqual(["2026-05-08"]);
  });

  it("excludes dates after range.to", () => {
    const m = { due_date: "2026-05-15", event_date: "2026-06-02" };
    expect(getPlacements(entry(m), { mode: "calendar", range: MAY })).toEqual(["2026-05-15"]);
  });

  it("includes endpoints inclusively", () => {
    const m = { due_date: "2026-05-01", event_date: "2026-05-31" };
    expect(getPlacements(entry(m), { mode: "calendar", range: MAY })).toEqual([
      "2026-05-01",
      "2026-05-31",
    ]);
  });
});

// ─── Recurrence expansion ──────────────────────────────────────────────────

describe("getPlacements recurrence", () => {
  it("expands every-Wednesday across the month", () => {
    const e = entry({ day_of_week: "wednesday" });
    const out = getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true });
    // Wednesdays in May 2026: 6, 13, 20, 27
    expect(out).toEqual(["2026-05-06", "2026-05-13", "2026-05-20", "2026-05-27"]);
  });

  it("expands every-15th of the month as a single date", () => {
    const e = entry({ day_of_month: "15" });
    expect(getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true })).toEqual([
      "2026-05-15",
    ]);
  });

  it("expands recurring text 'every Friday' from content", () => {
    const e = entry({}, { content: "I go to the market every Friday" });
    const out = getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true });
    // Fridays in May 2026: 1, 8, 15, 22, 29
    expect(out).toEqual(["2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22", "2026-05-29"]);
  });

  it("does NOT expand recurrence when a specific date is set (over-extraction guard)", () => {
    const e = entry({ event_date: "2026-05-01", day_of_week: "friday" });
    const out = getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true });
    expect(out).toEqual(["2026-05-01"]);
  });

  it("does NOT expand recurrence when a due_date is set", () => {
    const e = entry({ due_date: "2026-05-08", day_of_week: "friday" });
    const out = getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true });
    expect(out).toEqual(["2026-05-08"]);
  });

  it("requires a range when expandRecurrence is true", () => {
    const e = entry({ day_of_week: "monday" });
    expect(() => getPlacements(e, { mode: "calendar", expandRecurrence: true })).toThrow(/range/);
  });

  it("clamps day_of_month to the last day of short months", () => {
    const e = entry({ day_of_month: "31" });
    const FEB = { from: "2026-02-01", to: "2026-02-28" };
    expect(getPlacements(e, { mode: "calendar", range: FEB, expandRecurrence: true })).toEqual([
      "2026-02-28",
    ]);
  });

  it("works without expandRecurrence — recurring entry with no specific date returns []", () => {
    const e = entry({ day_of_week: "monday" });
    expect(getPlacements(e, { mode: "calendar", range: MAY })).toEqual([]);
  });
});

// ─── Canonical recurrence object (Phase 2) ─────────────────────────────────

describe("getPlacements canonical recurrence", () => {
  it("expands recurrence.dow weekly", () => {
    const e = entry({ recurrence: { freq: "weekly", dow: [3] } });
    expect(getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true })).toEqual([
      "2026-05-06",
      "2026-05-13",
      "2026-05-20",
      "2026-05-27",
    ]);
  });

  it("expands multiple recurrence.dow days in the same week", () => {
    const e = entry({ recurrence: { freq: "weekly", dow: [1, 4] } }); // Mon + Thu
    const out = getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true });
    // May 2026 Mons: 4, 11, 18, 25.  Thus: 7, 14, 21, 28.
    expect(out).toEqual([
      "2026-05-04",
      "2026-05-07",
      "2026-05-11",
      "2026-05-14",
      "2026-05-18",
      "2026-05-21",
      "2026-05-25",
      "2026-05-28",
    ]);
  });

  it("expands recurrence.dom monthly", () => {
    const e = entry({ recurrence: { freq: "monthly", dom: [15] } });
    expect(getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true })).toEqual([
      "2026-05-15",
    ]);
  });

  it("treats canonical recurrence and legacy day_of_week as equivalent (dedupes)", () => {
    const e = entry({ recurrence: { freq: "weekly", dow: [3] }, day_of_week: "wednesday" });
    expect(getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true })).toEqual([
      "2026-05-06",
      "2026-05-13",
      "2026-05-20",
      "2026-05-27",
    ]);
  });

  it("scheduled_for blocks recurrence the same way due_date does", () => {
    const e = entry({
      scheduled_for: "2026-05-06",
      recurrence: { freq: "weekly", dow: [3] },
    });
    expect(getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true })).toEqual([
      "2026-05-06",
    ]);
  });

  it("ignores invalid dow values (out of range)", () => {
    const e = entry({ recurrence: { freq: "weekly", dow: [-1, 7, 3] } });
    expect(getPlacements(e, { mode: "calendar", range: MAY, expandRecurrence: true })).toEqual([
      "2026-05-06",
      "2026-05-13",
      "2026-05-20",
      "2026-05-27",
    ]);
  });
});

// ─── Type filters ──────────────────────────────────────────────────────────

describe("getPlacements type filters", () => {
  it("never places persona entries on the calendar", () => {
    const e = entry({ due_date: "2026-05-08" }, { type: "persona" });
    expect(getPlacements(e, { mode: "calendar" })).toEqual([]);
  });

  it("never places vault secrets on the calendar", () => {
    const e = entry({ due_date: "2026-05-08" }, { type: "secret" });
    expect(getPlacements(e, { mode: "calendar" })).toEqual([]);
  });

  it("places normal todos and reminders", () => {
    const e1 = entry({ due_date: "2026-05-08" }, { type: "todo" });
    const e2 = entry({ due_date: "2026-05-08" }, { type: "reminder" });
    expect(getPlacements(e1, { mode: "actions" })).toEqual(["2026-05-08"]);
    expect(getPlacements(e2, { mode: "actions" })).toEqual(["2026-05-08"]);
  });
});

// ─── Completion filter ─────────────────────────────────────────────────────

describe("getPlacements completion filter", () => {
  it("excludes completed entries by default", () => {
    const e = entry({ due_date: "2026-05-08", status: "done" });
    expect(getPlacements(e, { mode: "actions" })).toEqual([]);
  });

  it("includes completed entries when includeCompleted is true", () => {
    const e = entry({ due_date: "2026-05-08", status: "done" });
    expect(getPlacements(e, { mode: "actions", includeCompleted: true })).toEqual(["2026-05-08"]);
  });

  it("isDone returns true only for the literal 'done' string", () => {
    expect(isDone(entry({ status: "done" }))).toBe(true);
    expect(isDone(entry({ status: "todo" }))).toBe(false);
    expect(isDone(entry({ status: "open" }))).toBe(false);
    expect(isDone(entry({ status: "active" }))).toBe(false);
    expect(isDone(entry({}))).toBe(false);
  });
});

// ─── Convenience wrappers ──────────────────────────────────────────────────

describe("getActionPlacements", () => {
  it("returns action-mode placements with no recurrence", () => {
    const e = entry({ due_date: "2026-05-08", day_of_week: "friday" });
    expect(getActionPlacements(e)).toEqual(["2026-05-08"]);
  });
});

describe("getCalendarPlacements", () => {
  it("returns calendar-mode placements with recurrence expanded", () => {
    const e = entry({ day_of_week: "wednesday" });
    expect(getCalendarPlacements(e, MAY)).toEqual([
      "2026-05-06",
      "2026-05-13",
      "2026-05-20",
      "2026-05-27",
    ]);
  });

  it("returns single placement for a specific date entry", () => {
    const e = entry({ due_date: "2026-05-15" });
    expect(getCalendarPlacements(e, MAY)).toEqual(["2026-05-15"]);
  });
});

// ─── Legacy wrappers (for back-compat during migration) ────────────────────

describe("legacy extractDates wrapper", () => {
  it("returns calendar-mode placements", () => {
    const e = entry({ due_date: "2026-05-01", event_date: "2026-05-15" });
    expect(extractDates(e).sort()).toEqual(["2026-05-01", "2026-05-15"]);
  });

  it("includes completed entries (legacy behaviour)", () => {
    const e = entry({ due_date: "2026-05-08", status: "done" });
    expect(extractDates(e)).toEqual(["2026-05-08"]);
  });
});

describe("legacy extractActionDates wrapper", () => {
  it("returns action-mode placements", () => {
    expect(extractActionDates(entry({ due_date: "2026-05-08" }))).toEqual(["2026-05-08"]);
    expect(extractActionDates(entry({ event_date: "2026-05-08" }))).toEqual([]);
  });
});

describe("legacy addRecurring wrapper", () => {
  it("does NOT add weekly recurrences when the entry has a specific event_date", () => {
    const e = entry({ event_date: "2026-05-01", day_of_week: "friday" });
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4);
    expect(adds).toEqual([]);
  });

  it("does NOT add weekly recurrences when the entry has a due_date", () => {
    const e = entry({ due_date: "2026-05-08", day_of_week: "friday" });
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4);
    expect(adds).toEqual([]);
  });

  it("DOES add weekly recurrences for a real recurring entry without a specific date", () => {
    const e = entry({ day_of_week: "friday" });
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4);
    expect(adds).toEqual(["2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22", "2026-05-29"]);
  });

  it("DOES add monthly recurrence from day_of_month when no specific date", () => {
    const e = entry({ day_of_month: "15" });
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4);
    expect(adds).toEqual(["2026-05-15"]);
  });

  it("ignores text-based 'every Friday' if a specific date is also set", () => {
    const e = entry({ event_date: "2026-05-01" }, { content: "every Friday I go to the market" });
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4);
    expect(adds).toEqual([]);
  });

  it("skips persona entries", () => {
    const e = entry({ day_of_week: "friday" }, { type: "persona" });
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4);
    expect(adds).toEqual([]);
  });
});
