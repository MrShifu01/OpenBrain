import { describe, it, expect } from "vitest";
import { getPriceTier, formatCost, filterByTier, sortWithRecommended, modelLabel, TIER_RECOMMENDED } from "../orModelFilter";
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

describe("sortWithRecommended", () => {
  const rec = TIER_RECOMMENDED.free;
  const recModel: ORModel = { id: rec, name: "Rec Model", pricing: { prompt: "0" } };
  const other1: ORModel = { id: "other-1", name: "Other 1", pricing: { prompt: "0" } };
  const other2: ORModel = { id: "other-2", name: "Other 2", pricing: { prompt: "0" } };

  it("puts recommended model first", () => {
    const result = sortWithRecommended([other1, other2, recModel], "free");
    expect(result[0].id).toBe(rec);
  });

  it("preserves order of remaining models", () => {
    const result = sortWithRecommended([other1, recModel, other2], "free");
    expect(result.map(m => m.id)).toEqual([rec, other1.id, other2.id]);
  });

  it("returns list unchanged when recommended not present", () => {
    const result = sortWithRecommended([other1, other2], "free");
    expect(result).toEqual([other1, other2]);
  });

  it("returns list unchanged for 'all' tier", () => {
    const result = sortWithRecommended([other1, recModel, other2], "all");
    expect(result.map(m => m.id)).toEqual([other1.id, recModel.id, other2.id]);
  });
});

describe("modelLabel", () => {
  const m: ORModel = { id: "test/model", name: "Test Model", pricing: { prompt: "0.0000025" } };

  it("includes cost in label", () => {
    expect(modelLabel(m)).toBe("Test Model — $2.50/1M");
  });

  it("appends (Recommended) when id matches recommendedId", () => {
    expect(modelLabel(m, "test/model")).toBe("Test Model — $2.50/1M (Recommended)");
  });

  it("does not append (Recommended) when id differs", () => {
    expect(modelLabel(m, "other/model")).toBe("Test Model — $2.50/1M");
  });
});
