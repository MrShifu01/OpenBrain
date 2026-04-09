import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../../src/ErrorBoundary";

function Bomb(): never {
  throw new Error("Test crash");
}

describe("ErrorBoundary", () => {
  it("renders error UI when child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("decorative emoji is hidden from screen readers", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    const emojiEl = container.querySelector('[aria-hidden="true"]');
    expect(emojiEl).not.toBeNull();
    expect(emojiEl?.textContent).toBe("🧠");
    spy.mockRestore();
  });
});
