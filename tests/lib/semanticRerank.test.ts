/**
 * S6-1: Semantic re-ranking — combineScores utility.
 * Re-ranks retrieved entries by combining semantic similarity with
 * keyword overlap and recency signals.
 */
import { describe, it, expect } from "vitest";
import { rerankEntries } from "../../src/lib/semanticRerank";

const entries = [
  { id: "a", title: "Smash Burger Recipe", content: "beef patty", similarity: 0.6, created_at: "2026-01-01T00:00:00Z" },
  { id: "b", title: "Staff Training Guide", content: "training schedule", similarity: 0.55, created_at: "2026-03-01T00:00:00Z" },
  { id: "c", title: "Smash Burger Secret Sauce", content: "sauce recipe burger", similarity: 0.7, created_at: "2026-01-15T00:00:00Z" },
];

describe("rerankEntries (S6-1)", () => {
  it("sorts by combined score descending", () => {
    const query = "smash burger sauce";
    const result = rerankEntries(entries, query);
    // "Secret Sauce" has highest similarity AND keyword overlap
    expect(result[0].id).toBe("c");
  });

  it("returns same number of entries", () => {
    const result = rerankEntries(entries, "burger");
    expect(result).toHaveLength(entries.length);
  });

  it("does not mutate the input array", () => {
    const copy = [...entries];
    rerankEntries(entries, "burger");
    expect(entries[0].id).toBe(copy[0].id);
  });

  it("handles empty array", () => {
    expect(rerankEntries([], "burger")).toEqual([]);
  });

  it("handles empty query — falls back to similarity order", () => {
    const result = rerankEntries(entries, "");
    expect(result[0].similarity).toBeGreaterThanOrEqual(result[1].similarity!);
  });
});
