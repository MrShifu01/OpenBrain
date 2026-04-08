import { describe, it, expect } from "vitest";
import { countEmbedMismatches } from "../../src/lib/embedMismatch";

describe("embed provider mismatch", () => {
  it("detects mismatch when switching provider", () => {
    const entries = [
      { id: "1", embedding_provider: "openai" },
      { id: "2", embedding_provider: "openai" },
      { id: "3", embedding_provider: null },
    ];
    const currentProvider = "openai";
    const newProvider = "google";
    const embeddedWithOld = entries.filter(
      e => e.embedding_provider && e.embedding_provider !== newProvider
    ).length;
    expect(embeddedWithOld).toBe(2);
  });
  it("no mismatch when selecting same provider", () => {
    const entries = [{ id: "1", embedding_provider: "openai" }];
    const newProvider = "openai";
    const mismatched = entries.filter(
      e => e.embedding_provider && e.embedding_provider !== newProvider
    ).length;
    expect(mismatched).toBe(0);
  });

  // S3-3: countEmbedMismatches utility
  it("countEmbedMismatches returns count of entries with different provider", () => {
    const entries = [
      { id: "1", embedding_provider: "openai" },
      { id: "2", embedding_provider: "openai" },
      { id: "3", embedding_provider: "google" },
      { id: "4", embedding_provider: null },
    ];
    expect(countEmbedMismatches(entries, "google")).toBe(2);
  });

  it("countEmbedMismatches returns 0 when all match", () => {
    const entries = [
      { id: "1", embedding_provider: "openai" },
      { id: "2", embedding_provider: "openai" },
    ];
    expect(countEmbedMismatches(entries, "openai")).toBe(0);
  });

  it("countEmbedMismatches ignores unembedded entries", () => {
    const entries = [
      { id: "1", embedding_provider: null },
      { id: "2", embedding_provider: undefined },
    ];
    expect(countEmbedMismatches(entries, "openai")).toBe(0);
  });
});
