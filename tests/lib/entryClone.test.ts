/**
 * S5-5: Entry cloning — buildClonePayload utility.
 */
import { describe, it, expect } from "vitest";
import { buildClonePayload } from "../../src/lib/entryClone";

const baseEntry = {
  id: "orig-1",
  title: "Smash Burger Recipe",
  content: "2 patties, special sauce",
  type: "recipe",
  tags: ["burger", "recipe"],
  metadata: { source_url: "https://example.com" },
  importance: 3,
  pinned: false,
  brain_id: "brain-abc",
};

describe("buildClonePayload (S5-5)", () => {
  it("prefixes title with 'Copy of'", () => {
    const clone = buildClonePayload(baseEntry);
    expect(clone.title).toBe("Copy of Smash Burger Recipe");
  });

  it("preserves content and tags", () => {
    const clone = buildClonePayload(baseEntry);
    expect(clone.content).toBe(baseEntry.content);
    expect(clone.tags).toEqual(baseEntry.tags);
  });

  it("does not carry over the original id", () => {
    const clone = buildClonePayload(baseEntry);
    expect((clone as any).id).toBeUndefined();
  });

  it("preserves type and metadata", () => {
    const clone = buildClonePayload(baseEntry);
    expect(clone.type).toBe("recipe");
    expect(clone.metadata).toEqual(baseEntry.metadata);
  });

  it("resets pinned to false", () => {
    const entry = { ...baseEntry, pinned: true };
    const clone = buildClonePayload(entry);
    expect(clone.pinned).toBe(false);
  });

  it("truncates already-prefixed title to avoid double prefix", () => {
    const entry = { ...baseEntry, title: "Copy of Smash Burger Recipe" };
    const clone = buildClonePayload(entry);
    expect(clone.title).toBe("Copy of Smash Burger Recipe");
  });
});
