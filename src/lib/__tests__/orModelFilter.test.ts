import { describe, it, expect } from "vitest";
import { getPriceTier, formatCost, filterByTier } from "../orModelFilter";
import type { ORModel } from "../orModelFilter";

const free: ORModel = { id: "google/gemini-flash:free", name: "Gemini Flash Free", pricing: { prompt: "0" } };
const cheap: ORModel = { id: "gpt-4o-mini", name: "GPT-4o Mini", pricing: { prompt: "0.00000015" } }; // $0.15/1M
// $2–$15/1M => 2e-6 to 1.5e-5 per token
const good2: ORModel = { id: "gpt-4o", name: "GPT-4o", pricing: { prompt: "0.0000025" } }; // $2.50/1M
const frontier: ORModel = { id: "claude-opus", name: "Claude Opus", pricing: { prompt: "0.000015" } }; // $15/1M
const noPricing: ORModel = { id: "unknown", name: "Unknown" };

describe("getPriceTier", () => {
  it("returns free for price 0", () => {
    expect(getPriceTier({ prompt: "0" })).toBe("free");
  });

  it("returns cheap for price < $2/1M", () => {
    expect(getPriceTier({ prompt: "0.00000015" })).toBe("cheap"); // $0.15/1M
    expect(getPriceTier({ prompt: "0.0000019" })).toBe("cheap");  // $1.90/1M
  });

  it("returns good for price $2–$15/1M", () => {
    expect(getPriceTier({ prompt: "0.0000025" })).toBe("good");  // $2.50/1M
    expect(getPriceTier({ prompt: "0.000010" })).toBe("good");   // $10/1M
  });

  it("returns frontier for price >= $15/1M", () => {
    expect(getPriceTier({ prompt: "0.000015" })).toBe("frontier"); // $15/1M
    expect(getPriceTier({ prompt: "0.000060" })).toBe("frontier"); // $60/1M
  });

  it("returns frontier for missing pricing", () => {
    expect(getPriceTier(undefined)).toBe("frontier");
    expect(getPriceTier({})).toBe("frontier");
  });
});

describe("formatCost", () => {
  it("returns 'Free' for price 0", () => {
    expect(formatCost({ prompt: "0" })).toBe("Free");
  });

  it("formats cost per 1M tokens", () => {
    expect(formatCost({ prompt: "0.0000025" })).toBe("$2.50/1M");
    expect(formatCost({ prompt: "0.000015" })).toBe("$15.00/1M");
    expect(formatCost({ prompt: "0.00000015" })).toBe("$0.15/1M");
  });

  it("returns empty string for missing pricing", () => {
    expect(formatCost(undefined)).toBe("");
    expect(formatCost({})).toBe("");
  });
});

describe("filterByTier", () => {
  const models = [free, cheap, good2, frontier, noPricing];

  it("returns all models for 'all'", () => {
    expect(filterByTier(models, "all")).toHaveLength(5);
  });

  it("returns only free models", () => {
    const result = filterByTier(models, "free");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("google/gemini-flash:free");
  });

  it("returns only cheap models", () => {
    const result = filterByTier(models, "cheap");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("gpt-4o-mini");
  });

  it("returns only good models", () => {
    const result = filterByTier(models, "good");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("gpt-4o");
  });

  it("returns only frontier models (including unpriced)", () => {
    const result = filterByTier(models, "frontier");
    expect(result).toHaveLength(2);
    expect(result.map(m => m.id)).toContain("claude-opus");
    expect(result.map(m => m.id)).toContain("unknown");
  });
});
