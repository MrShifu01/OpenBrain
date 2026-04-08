/**
 * S5-6: Search history in sessionStorage.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { addSearchHistory, getSearchHistory, clearSearchHistory } from "../../src/lib/searchHistory";

describe("searchHistory (S5-6)", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores a search query", () => {
    addSearchHistory("smash burger");
    expect(getSearchHistory()).toContain("smash burger");
  });

  it("deduplicates: adding same query again moves it to front", () => {
    addSearchHistory("burger");
    addSearchHistory("recipe");
    addSearchHistory("burger");
    const history = getSearchHistory();
    expect(history[0]).toBe("burger");
    expect(history.filter((h) => h === "burger")).toHaveLength(1);
  });

  it("keeps at most 20 entries", () => {
    for (let i = 0; i < 25; i++) addSearchHistory(`query${i}`);
    expect(getSearchHistory().length).toBeLessThanOrEqual(20);
  });

  it("returns empty array when nothing stored", () => {
    expect(getSearchHistory()).toEqual([]);
  });

  it("clearSearchHistory removes all entries", () => {
    addSearchHistory("test");
    clearSearchHistory();
    expect(getSearchHistory()).toEqual([]);
  });
});
