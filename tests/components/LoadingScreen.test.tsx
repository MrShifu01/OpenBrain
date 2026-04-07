/**
 * Tests for the neural-net LoadingScreen component.
 * - Renders the OpenBrain brand name
 * - Renders the animated loading bar (role=progressbar or identifiable element)
 * - Renders the synapse background element
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingScreen from "../../src/components/LoadingScreen";

describe("LoadingScreen", () => {
  it("renders the OpenBrain brand name", () => {
    render(<LoadingScreen />);
    expect(screen.getByText("OpenBrain")).toBeInTheDocument();
  });

  it("renders the Neural Interface subtitle", () => {
    render(<LoadingScreen />);
    expect(screen.getByText(/neural interface/i)).toBeInTheDocument();
  });

  it("renders the synapse ambient background", () => {
    const { container } = render(<LoadingScreen />);
    expect(container.querySelector(".synapse-bg")).toBeInTheDocument();
  });

  it("renders the animated loading bar", () => {
    const { container } = render(<LoadingScreen />);
    // The loading bar has a specific inline animation style
    const bar = container.querySelector("[style*='loading-bar']");
    expect(bar).toBeInTheDocument();
  });
});
