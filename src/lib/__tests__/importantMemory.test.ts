import { describe, it, expect } from "vitest";
import {
  generateMemoryKey,
  IMPORTANT_MEMORY_TYPES,
  IMPORTANT_MEMORY_TYPE_LABEL,
} from "../importantMemory";

describe("generateMemoryKey", () => {
  it("produces a deterministic slug from type + title", () => {
    expect(generateMemoryKey("fact", "Wi-Fi password for the studio")).toBe(
      "fact:wi_fi_password_for_the_studio",
    );
  });

  it("collapses whitespace and lowercases", () => {
    expect(generateMemoryKey("preference", "  COFFEE   black,   no sugar  ")).toBe(
      "preference:coffee_black_no_sugar",
    );
  });

  it("strips smart quotes and apostrophes", () => {
    expect(generateMemoryKey("decision", "It's the partner's choice")).toBe(
      "decision:its_the_partners_choice",
    );
  });

  it("strips combining diacritics via NFKD", () => {
    expect(generateMemoryKey("fact", "Café Latté")).toBe("fact:cafe_latte");
  });

  it("treats punctuation as a word break", () => {
    expect(generateMemoryKey("obligation", "Renew passport — by July 2026!")).toBe(
      "obligation:renew_passport_by_july_2026",
    );
  });

  it("returns the same key for the same inputs (idempotent)", () => {
    const a = generateMemoryKey("fact", "Anniversary date");
    const b = generateMemoryKey("fact", "Anniversary date");
    expect(a).toBe(b);
  });

  it("distinguishes by type prefix", () => {
    expect(generateMemoryKey("fact", "Coffee preference")).not.toBe(
      generateMemoryKey("preference", "Coffee preference"),
    );
  });

  it("caps slug length at 80 chars", () => {
    const longTitle = "a ".repeat(200).trim();
    const key = generateMemoryKey("fact", longTitle);
    const slug = key.slice("fact:".length);
    expect(slug.length).toBeLessThanOrEqual(80);
  });

  it("throws on empty title", () => {
    expect(() => generateMemoryKey("fact", "")).toThrow();
    expect(() => generateMemoryKey("fact", "   ")).toThrow();
    expect(() => generateMemoryKey("fact", "!!!")).toThrow();
  });
});

describe("IMPORTANT_MEMORY_TYPES", () => {
  it("has exactly the four v0 types", () => {
    expect(IMPORTANT_MEMORY_TYPES).toEqual(["fact", "preference", "decision", "obligation"]);
  });

  it("has a human label for every type", () => {
    for (const t of IMPORTANT_MEMORY_TYPES) {
      expect(IMPORTANT_MEMORY_TYPE_LABEL[t]).toBeTruthy();
    }
  });
});
