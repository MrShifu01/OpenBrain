import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/learningEngine", () => ({
  getLearningsContext: vi.fn(),
}));

import { getLearningsContext } from "../../src/lib/learningEngine";
import { buildSystemPrompt } from "../../src/lib/systemPromptBuilder";

const mockGetLearnings = getLearningsContext as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGetLearnings.mockReturnValue("");
});

// Every prompt now starts with a [Context] block carrying today's date —
// flash-lite has no internal clock and "this Friday" was extracting wrong
// without it. Tests assert the rest of the structure around that prefix.
const DATE_CONTEXT_RE = /^\[Context\]\nToday is \d{4}-\d{2}-\d{2} \(\w+\)\..*?\n\n/s;

describe("buildSystemPrompt", () => {
  it("always prepends [Context] with today's date", () => {
    const result = buildSystemPrompt({ base: "anything" });
    expect(result).toMatch(DATE_CONTEXT_RE);
  });

  it("returns just the date context when called with no arguments", () => {
    const result = buildSystemPrompt({});
    expect(result).toMatch(DATE_CONTEXT_RE);
    // Empty base means nothing after the context block.
    expect(result.replace(DATE_CONTEXT_RE, "")).toBe("");
  });

  it("appends base unchanged after the date context when no memoryGuide or brainId", () => {
    const result = buildSystemPrompt({ base: "You are helpful." });
    expect(result.replace(DATE_CONTEXT_RE, "")).toBe("You are helpful.");
  });

  it("prepends memory guide in Classification Guide / Task format", () => {
    const result = buildSystemPrompt({
      base: "Classify this.",
      memoryGuide: "Use types: note, task.",
    });
    // Guide wraps the context-prefixed task. Stripping the context from
    // inside the [Task] block leaves the original base.
    expect(result.startsWith("[Classification Guide]\nUse types: note, task.\n\n[Task]\n[Context]\n")).toBe(true);
    expect(result.endsWith("Classify this.")).toBe(true);
  });

  it("appends learnings block when brainId is provided and learnings exist", () => {
    mockGetLearnings.mockReturnValue("User prefers short titles.");
    const result = buildSystemPrompt({
      base: "Do something.",
      brainId: "brain-1",
      withLearnings: true,
    });
    expect(result).toContain("--- USER LEARNING CONTEXT ---");
    expect(result).toContain("User prefers short titles.");
    expect(result).toContain("--- END LEARNING CONTEXT ---");
    expect(mockGetLearnings).toHaveBeenCalledWith("brain-1");
  });

  it("does not append learnings block when getLearningsContext returns empty string", () => {
    mockGetLearnings.mockReturnValue("");
    const result = buildSystemPrompt({
      base: "Do something.",
      brainId: "brain-1",
      withLearnings: true,
    });
    expect(result.replace(DATE_CONTEXT_RE, "")).toBe("Do something.");
    expect(result).not.toContain("LEARNING CONTEXT");
  });

  it("composes guide then base then learnings in correct order", () => {
    mockGetLearnings.mockReturnValue("Prefer note type.");
    const result = buildSystemPrompt({
      base: "Classify.",
      memoryGuide: "Guide here.",
      brainId: "brain-2",
      withLearnings: true,
    });
    const guideIdx = result.indexOf("[Classification Guide]");
    const taskIdx = result.indexOf("[Task]");
    const learnIdx = result.indexOf("USER LEARNING CONTEXT");
    expect(guideIdx).toBeLessThan(taskIdx);
    expect(taskIdx).toBeLessThan(learnIdx);
  });
});
