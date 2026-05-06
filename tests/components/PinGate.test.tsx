import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("../../src/lib/aiSettings", () => ({ getUserId: () => "test-user" }));
vi.mock("../../src/lib/authFetch", () => ({ authFetch: vi.fn() }));
vi.mock("../../src/ThemeContext", () => ({
  useTheme: () => ({ t: {}, isDark: true, toggleTheme: () => {} }),
}));

// Stub localStorage
beforeEach(() => {
  vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
});

async function renderPinGate(isSetup = false) {
  const { PinGate } = await import("../../src/lib/pin");
  return render(<PinGate onSuccess={vi.fn()} onCancel={vi.fn()} isSetup={isSetup} />);
}

describe("PinGate — accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
  });

  it("overlay has role=dialog", async () => {
    await renderPinGate(true);
    // Radix Dialog portals to document.body — query there, not container.
    // Radix omits aria-modal intentionally (focus-trap + RemoveScroll + hide-
    // others handle the modal semantics for AT). role=dialog is the contract.
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
  });

  it("dialog has aria-labelledby pointing to visible title", async () => {
    await renderPinGate(true);
    const dialog = document.body.querySelector('[role="dialog"]');
    const labelledBy = dialog?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const titleEl = document.body.querySelector(`#${labelledBy}`);
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBeTruthy();
  });

  it("PIN input has an accessible label (not just placeholder)", async () => {
    await renderPinGate(true);
    const input = document.body.querySelector("input");
    expect(input).not.toBeNull();
    // Must expose a non-empty accessible label (aria-label or labelledby).
    const ariaLabel = input?.getAttribute("aria-label");
    const labelledBy = input?.getAttribute("aria-labelledby");
    expect(Boolean(ariaLabel) || Boolean(labelledBy)).toBe(true);
  });

  it("error message container has role=alert so AT announces it", async () => {
    await renderPinGate(true);
    const alertEl = document.body.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
  });

  it("decorative emoji is aria-hidden", async () => {
    await renderPinGate(true);
    const emoji = Array.from(
      document.body.querySelectorAll('[aria-hidden="true"]'),
    ).find((el) => (el.textContent ?? "").includes("🔒"));
    expect(emoji).toBeDefined();
  });
});
