import { describe, it, expect } from "vitest";
import { extractPhone, toWaUrl } from "../../src/lib/phone";
import type { Entry } from "../../src/types";

describe("extractPhone", () => {
  it("extracts E.164 phone number from content (any country)", () => {
    const entry: Entry = { id: "1", title: "Test", type: "contact", content: "Call +27612345678" };
    expect(extractPhone(entry)).toBe("+27612345678");
  });

  it("normalizes locale-formatted ZA number from metadata to E.164", () => {
    const entry: Entry = {
      id: "2",
      title: "Test",
      type: "contact",
      metadata: { phone: "0612345678" },
    };
    expect(extractPhone(entry, "ZA")).toBe("+27612345678");
  });

  it("normalizes locale-formatted US number from metadata to E.164", () => {
    const entry: Entry = {
      id: "3",
      title: "Test",
      type: "contact",
      metadata: { phone: "(415) 555-2671" },
    };
    expect(extractPhone(entry, "US")).toBe("+14155552671");
  });

  it("recognises international +CC numbers regardless of default country", () => {
    const entry: Entry = {
      id: "4",
      title: "Test",
      type: "contact",
      metadata: { phone: "+44 20 7946 0958" },
    };
    expect(extractPhone(entry, "ZA")).toBe("+442079460958");
  });

  it("falls through structured keys before scanning content", () => {
    const entry: Entry = {
      id: "5",
      title: "Test",
      type: "contact",
      content: "secondary number +27821111111",
      metadata: { mobile: "+27612345678" },
    };
    expect(extractPhone(entry)).toBe("+27612345678");
  });

  it("returns null when no phone found", () => {
    const entry: Entry = { id: "6", title: "Test", type: "note" };
    expect(extractPhone(entry)).toBeNull();
  });
});

describe("toWaUrl", () => {
  it("converts E.164 number to WhatsApp URL", () => {
    expect(toWaUrl("+27612345678")).toBe("https://wa.me/27612345678");
  });

  it("normalizes locale-formatted ZA number to WhatsApp URL with country code", () => {
    expect(toWaUrl("0612345678", "ZA")).toBe("https://wa.me/27612345678");
  });

  it("normalizes a US number to WhatsApp URL", () => {
    expect(toWaUrl("(415) 555-2671", "US")).toBe("https://wa.me/14155552671");
  });

  it("strips formatting from a +CC number", () => {
    expect(toWaUrl("+44 20 7946 0958")).toBe("https://wa.me/442079460958");
  });
});
