import { describe, it, expect } from "vitest";
import { addRecurring } from "../../src/views/todoUtils";
import type { Entry } from "../../src/types";

// Regression: AI enrichment over-extracted "this Friday" by setting BOTH
// event_date AND day_of_week, which made the calendar fabricate weekly
// occurrences (including past weeks) on top of the real one-shot date.
// addRecurring must bail out as soon as the entry has any specific
// calendar date in metadata.

function entry(metadata: Record<string, unknown>): Entry {
  return {
    id: "e1",
    user_id: "u1",
    brain_id: "b1",
    title: "Cars in the Park market",
    content: "Visit the cars in the park market this Friday",
    metadata,
    tags: [],
    type: "reminder",
    workspace: "personal",
    created_at: "2026-04-27T10:00:00Z",
    updated_at: "2026-04-27T10:00:00Z",
  } as unknown as Entry;
}

describe("addRecurring", () => {
  it("does NOT add weekly recurrences when the entry has a specific event_date", () => {
    const e = entry({ event_date: "2026-05-01", day_of_week: "friday" });
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4 /* May */);
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
    addRecurring([e], (key) => adds.push(key), 2026, 4 /* May 2026 */);
    // Fridays in May 2026: 1, 8, 15, 22, 29
    expect(adds).toEqual(["2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22", "2026-05-29"]);
  });

  it("DOES add monthly recurrence from day_of_month when no specific date", () => {
    const e = entry({ day_of_month: "15" });
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4);
    expect(adds).toEqual(["2026-05-15"]);
  });

  it("ignores text-based 'every Friday' if a specific date is also set", () => {
    const e = entry({ event_date: "2026-05-01" });
    e.content = "every Friday I go to the market";
    const adds: string[] = [];
    addRecurring([e], (key) => adds.push(key), 2026, 4);
    expect(adds).toEqual([]);
  });
});
