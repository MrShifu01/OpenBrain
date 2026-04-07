/**
 * S6-2: Learning-informed suggestions — buildLearningInformedPrompt.
 */
import { describe, it, expect } from "vitest";
import { buildLearningInformedPrompt } from "../../src/lib/learningPrompt";

describe("buildLearningInformedPrompt (S6-2)", () => {
  it("appends learnings block when learnings are available", () => {
    const base = "Generate follow-up questions for this entry.";
    const learnings = "[Learned Preferences]\n- User prefers concise bullet answers.";
    const result = buildLearningInformedPrompt(base, learnings);
    expect(result).toContain(learnings);
    expect(result).toContain(base);
  });

  it("returns base prompt unchanged when learnings are empty string", () => {
    const base = "Generate follow-up questions for this entry.";
    expect(buildLearningInformedPrompt(base, "")).toBe(base);
  });

  it("returns base prompt unchanged when learnings are null", () => {
    const base = "Generate follow-up questions.";
    expect(buildLearningInformedPrompt(base, null)).toBe(base);
  });

  it("places learnings before the base prompt content", () => {
    const base = "Generate follow-up questions.";
    const learnings = "[Learned Preferences]\n- Keep it short.";
    const result = buildLearningInformedPrompt(base, learnings);
    expect(result.indexOf(learnings)).toBeLessThan(result.indexOf("Generate follow-up questions."));
  });
});
