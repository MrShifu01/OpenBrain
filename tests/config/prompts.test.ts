import { describe, it, expect } from "vitest";
import { PROMPTS } from "../../src/config/prompts";

describe("prompts", () => {
  it("exports all required prompt keys", () => {
    // CHAT was deleted — server has its own CHAT prompt; the client copy
    // was registered but never imported anywhere. Server-side chat goes
    // through api/_lib/prompts.ts CHAT_AGENT instead.
    const expectedKeys = [
      "CAPTURE",
      "NUDGE",
      "QA_PARSE",
      "FILL_BRAIN",
      "ENTRY_AUDIT",
      "LINK_DISCOVERY",
      "LINK_DISCOVERY_PAIRS",
      "CONNECTION_FINDER",
    ];
    expectedKeys.forEach((key) => {
      expect(PROMPTS[key as keyof typeof PROMPTS]).toBeDefined();
      expect(typeof PROMPTS[key as keyof typeof PROMPTS]).toBe("string");
    });
  });

  it("CAPTURE prompt mentions JSON format", () => {
    expect(PROMPTS.CAPTURE).toContain("JSON");
  });

  it("ENTRY_AUDIT prompt mentions valid types", () => {
    expect(PROMPTS.ENTRY_AUDIT).toContain("TYPE_MISMATCH");
    expect(PROMPTS.ENTRY_AUDIT).toContain("PHONE_FOUND");
  });

  it("exports FILE_SPLIT prompt for multi-entry extraction", () => {
    expect(PROMPTS.FILE_SPLIT).toBeDefined();
    expect(PROMPTS.FILE_SPLIT).toContain("JSON");
    expect(PROMPTS.FILE_SPLIT).toContain("title");
  });

  it("ENTRY_AUDIT includes SPLIT_SUGGESTED for long entries", () => {
    expect(PROMPTS.ENTRY_AUDIT).toContain("SPLIT_SUGGESTED");
  });
});
