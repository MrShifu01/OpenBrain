import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OnboardingModal from "../OnboardingModal";

describe("OnboardingModal — structure", () => {
  it("wraps content in role=dialog", () => {
    render(<OnboardingModal onComplete={vi.fn()} />);
    // Radix Dialog portals to document.body and omits aria-modal — modal
    // semantics come from FocusScope + RemoveScroll + hideOthers.
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
  });

  // Step 1 deliberately has no Skip button (mandatory first capture, anti-bounce
  // safeguard). Skip reappears on step 2 once the first capture lands. The
  // e2e spec `e2e/specs/onboarding.spec.ts` exercises the full
  // capture → Skip flow end-to-end; replicating it here would just race the
  // imperative state machine in unit-land.
  it("does NOT render a Skip button on the first step", () => {
    render(<OnboardingModal onComplete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /skip/i })).toBeNull();
  });
});

describe("OnboardingModal — capture step", () => {
  it("shows the capture textarea on first render", () => {
    render(<OnboardingModal onComplete={vi.fn()} />);
    // The first step is the capture textarea — placeholder text changes,
    // but the field itself is the only textarea on screen.
    expect(document.body.querySelector("textarea")).not.toBeNull();
  });
});
