import { render, screen, fireEvent } from "@testing-library/react";
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

  it("renders a Skip button", () => {
    render(<OnboardingModal onComplete={vi.fn()} />);
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("calls onComplete when Skip is clicked", () => {
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
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
