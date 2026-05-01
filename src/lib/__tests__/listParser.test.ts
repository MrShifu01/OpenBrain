/**
 * Parser is the wire format for what counts as a "list item" — these tests
 * pin the supported syntaxes so a future regex tweak doesn't silently change
 * how pasted lists get sliced.
 */
import { describe, it, expect } from "vitest";
import { parseListText, MAX_ITEMS_PER_PARSE } from "../listParser";

function titles(items: ReturnType<typeof parseListText>): string[] {
  return items.map((i) => i.title);
}

describe("parseListText", () => {
  it("returns [] for empty / whitespace input", () => {
    expect(parseListText("")).toEqual([]);
    expect(parseListText("   \n\n  \t\n")).toEqual([]);
  });

  it("splits plain newline-separated lines", () => {
    expect(titles(parseListText("milk\neggs\nbread"))).toEqual(["milk", "eggs", "bread"]);
  });

  it("strips dash bullets", () => {
    expect(titles(parseListText("- milk\n- eggs\n-bread"))).toEqual(["milk", "eggs", "-bread"]);
    // Note: `-bread` (no space) is intentionally NOT a bullet — we require the
    // trailing space so URLs / hyphenated words don't get mangled.
  });

  it("strips * + • bullets", () => {
    expect(titles(parseListText("* milk\n+ eggs\n• bread"))).toEqual(["milk", "eggs", "bread"]);
  });

  it("strips numbered prefixes (`1.`, `1)`, `(1)`)", () => {
    expect(titles(parseListText("1. milk\n2) eggs\n(3) bread"))).toEqual(["milk", "eggs", "bread"]);
  });

  it("preserves checkbox completed state", () => {
    const items = parseListText("[ ] milk\n[x] eggs\n[X] bread");
    expect(items.map((i) => ({ title: i.title, completed: i.completed }))).toEqual([
      { title: "milk", completed: false },
      { title: "eggs", completed: true },
      { title: "bread", completed: true },
    ]);
  });

  it("handles checkbox with bullet prefix (`- [x] foo`)", () => {
    const items = parseListText("- [x] milk\n* [ ] eggs");
    expect(items.map((i) => ({ title: i.title, completed: i.completed }))).toEqual([
      { title: "milk", completed: true },
      { title: "eggs", completed: false },
    ]);
  });

  it("takes col-1 of CSV rows", () => {
    expect(titles(parseListText("milk,2L,fridge\neggs,dozen,counter"))).toEqual(["milk", "eggs"]);
  });

  it("strips matching outer quotes from CSV first cell", () => {
    expect(titles(parseListText('"milk, the good kind",2L\n"eggs",dozen'))).toEqual([
      "milk, the good kind",
      "eggs",
    ]);
  });

  it("trims whitespace and skips blank lines", () => {
    expect(titles(parseListText("   foo  \n\n  bar  \n   "))).toEqual(["foo", "bar"]);
  });

  it("preserves duplicates (user may want them)", () => {
    expect(titles(parseListText("milk\nmilk\neggs"))).toEqual(["milk", "milk", "eggs"]);
  });

  it("assigns sequential order starting at 0", () => {
    const items = parseListText("a\nb\nc");
    expect(items.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it("generates a unique id per item", () => {
    const items = parseListText("a\nb\nc");
    const ids = new Set(items.map((i) => i.id));
    expect(ids.size).toBe(3);
    expect([...ids].every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it(`truncates at MAX_ITEMS_PER_PARSE (${MAX_ITEMS_PER_PARSE})`, () => {
    const huge = Array.from({ length: MAX_ITEMS_PER_PARSE + 50 }, (_, i) => `item-${i}`).join("\n");
    const items = parseListText(huge);
    expect(items).toHaveLength(MAX_ITEMS_PER_PARSE);
    expect(items[0].title).toBe("item-0");
    expect(items[MAX_ITEMS_PER_PARSE - 1].title).toBe(`item-${MAX_ITEMS_PER_PARSE - 1}`);
  });

  it("treats non-bullet, non-numbered, non-CSV lines as plain titles", () => {
    expect(titles(parseListText("Pick up dry cleaning"))).toEqual(["Pick up dry cleaning"]);
  });

  it("handles mixed input (the realistic paste case)", () => {
    const input = `Groceries — week 18

- milk
- eggs
1. bread
[x] flour (already have)
[ ] olive oil

something not bulleted
"with, comma",extra,col`;
    expect(titles(parseListText(input))).toEqual([
      "Groceries — week 18",
      "milk",
      "eggs",
      "bread",
      "flour (already have)",
      "olive oil",
      "something not bulleted",
      "with, comma",
    ]);
  });

  it("does not treat a hyphenated phrase mid-line as a bullet", () => {
    expect(titles(parseListText("re-up batteries\nstate-of-the-art idea"))).toEqual([
      "re-up batteries",
      "state-of-the-art idea",
    ]);
  });
});
