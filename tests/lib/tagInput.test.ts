/**
 * S5-2: Tag autocomplete utility.
 * suggestTags(input, allTags) — returns matching tags for autocomplete.
 */
import { describe, it, expect } from "vitest";
import { suggestTags, normalizeTags } from "../../src/lib/tagInput";

describe("suggestTags (S5-2)", () => {
  const allTags = ["burger", "recipe", "staff", "supplier", "smash", "beef", "bun"];

  it("returns tags matching the current partial input", () => {
    expect(suggestTags("b", allTags)).toEqual(expect.arrayContaining(["burger", "beef", "bun"]));
  });

  it("is case-insensitive", () => {
    expect(suggestTags("BUR", allTags)).toContain("burger");
  });

  it("returns empty array for empty input", () => {
    expect(suggestTags("", allTags)).toHaveLength(0);
  });

  it("returns at most 8 suggestions", () => {
    const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const result = suggestTags("tag", manyTags);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("excludes already-selected tags", () => {
    const selected = ["burger"];
    expect(suggestTags("b", allTags, selected)).not.toContain("burger");
  });
});

describe("normalizeTags (S5-2)", () => {
  it("splits comma-separated string into trimmed lowercase tags", () => {
    expect(normalizeTags("Burger, Recipe , STAFF")).toEqual(["burger", "recipe", "staff"]);
  });

  it("deduplicates tags", () => {
    expect(normalizeTags("burger, burger, bun")).toEqual(["burger", "bun"]);
  });

  it("filters empty tokens", () => {
    expect(normalizeTags("burger,,bun")).toEqual(["burger", "bun"]);
  });
});
