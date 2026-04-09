import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/lib/authFetch", () => ({
  authFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
}));

import {
  search,
  tokenSearchStrategy,
  keywordSearchStrategy,
} from "../../src/lib/search";
import { indexEntry } from "../../src/lib/searchIndex";
import type { Entry } from "../../src/types";

const makeEntry = (id: string, title: string, content = "", tags: string[] = []): Entry =>
  ({ id, title, content, type: "note", tags, created_at: "", metadata: {} } as any);

describe("SearchStrategy", () => {
  const entries = [
    makeEntry("1", "My passport number", "ZA123456", ["document"]),
    makeEntry("2", "Grocery list", "Milk eggs bread", ["shopping"]),
    makeEntry("3", "Work contact John", "john@example.com", ["person"]),
  ];

  describe("tokenSearchStrategy", () => {
    it("returns matching entries for a token query", async () => {
      // Index entries so the inverted index has data
      entries.forEach(indexEntry);
      const results = await tokenSearchStrategy.search("passport", entries);
      expect(results.some((e) => e.id === "1")).toBe(true);
    });

    it("returns empty array for empty query", async () => {
      const results = await tokenSearchStrategy.search("", entries);
      expect(results).toEqual([]);
    });
  });

  describe("keywordSearchStrategy", () => {
    it("scores and returns entries ranked by relevance", async () => {
      const results = await keywordSearchStrategy.search("john contact", entries);
      expect(results[0].id).toBe("3");
    });

    it("returns all entries for empty query", async () => {
      const results = await keywordSearchStrategy.search("", entries);
      expect(results).toHaveLength(entries.length);
    });
  });

  describe("search dispatcher", () => {
    it("delegates to provided strategy", async () => {
      const mockStrategy = { search: vi.fn().mockResolvedValue([entries[0]]) };
      const results = await search("test", entries, mockStrategy);
      expect(mockStrategy.search).toHaveBeenCalledWith("test", entries, undefined);
      expect(results).toEqual([entries[0]]);
    });

    it("returns empty array for empty query without calling strategy", async () => {
      const mockStrategy = { search: vi.fn() };
      const results = await search("", entries, mockStrategy);
      expect(mockStrategy.search).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });
  });
});
