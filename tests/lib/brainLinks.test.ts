/**
 * S5-3: Drag-to-organize brain links — reorder utility.
 */
import { describe, it, expect } from "vitest";
import { reorderLinks } from "../../src/lib/brainLinks";

const links = [
  { id: "a", from: "1", to: "2", rel: "related" },
  { id: "b", from: "1", to: "3", rel: "mentions" },
  { id: "c", from: "1", to: "4", rel: "links-to" },
];

describe("reorderLinks (S5-3)", () => {
  it("moves an item from higher to lower index", () => {
    const result = reorderLinks(links, 0, 2);
    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("c");
    expect(result[2].id).toBe("a");
  });

  it("moves an item from lower to higher index", () => {
    const result = reorderLinks(links, 2, 0);
    expect(result[0].id).toBe("c");
    expect(result[1].id).toBe("a");
    expect(result[2].id).toBe("b");
  });

  it("returns same order when from and to are equal", () => {
    const result = reorderLinks(links, 1, 1);
    expect(result.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the original array", () => {
    reorderLinks(links, 0, 2);
    expect(links[0].id).toBe("a");
  });
});
