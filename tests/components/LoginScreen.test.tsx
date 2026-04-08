/**
 * Tests for LoginScreen
 * - Error handling: "Database error saving new user" shows friendly message
 * - Generic errors pass through unchanged
 * - Sent state shown on success
 * - No hardcoded color values (CSS vars only)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSignInWithOtp = vi.fn();

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: vi.fn(),
    },
  },
}));

// Lazy import after mock is set up
async function renderLoginScreen() {
  const { default: LoginScreen } = await import("../../src/LoginScreen");
  return render(<LoginScreen />);
}

describe("LoginScreen — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("maps 'Database error saving new user' to a user-friendly message", async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: "Database error saving new user" },
      data: {},
    });

    const { default: LoginScreen } = await import("../../src/LoginScreen");
    render(<LoginScreen />);

    // Show the email form
    await userEvent.click(screen.getByText("Start free"));

    // Enter email and submit
    await userEvent.type(screen.getByPlaceholderText("neural@email.com"), "new@example.com");
    await userEvent.click(screen.getByText("Send access code"));

    await waitFor(() => {
      // Raw Supabase error must NOT be shown
      expect(screen.queryByText("Database error saving new user")).not.toBeInTheDocument();
      // A friendly message must appear
      expect(screen.getByText(/account setup failed/i)).toBeInTheDocument();
    });
  });

  it("passes other error messages through unchanged", async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: "Email rate limit exceeded" },
      data: {},
    });

    const { default: LoginScreen } = await import("../../src/LoginScreen");
    render(<LoginScreen />);

    await userEvent.click(screen.getByText("Start free"));
    await userEvent.type(screen.getByPlaceholderText("neural@email.com"), "user@example.com");
    await userEvent.click(screen.getByText("Send access code"));

    await waitFor(() => {
      expect(screen.getByText("Email rate limit exceeded")).toBeInTheDocument();
    });
  });

  it("shows the sent state when signInWithOtp succeeds", async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null, data: {} });

    const { default: LoginScreen } = await import("../../src/LoginScreen");
    render(<LoginScreen />);

    await userEvent.click(screen.getByText("Start free"));
    await userEvent.type(screen.getByPlaceholderText("neural@email.com"), "user@example.com");
    await userEvent.click(screen.getByText("Send access code"));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });
});

describe("LoginScreen — no hardcoded colors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("uses CSS variables not hardcoded oklch values in inline styles", async () => {
    const { default: LoginScreen } = await import("../../src/LoginScreen");
    const { container } = render(<LoginScreen />);

    // Walk all elements checking inline styles for raw oklch() values
    const allElements = container.querySelectorAll("*");
    const violations: string[] = [];
    allElements.forEach((el) => {
      const style = (el as HTMLElement).getAttribute("style") || "";
      if (/oklch\(/.test(style)) {
        violations.push(`${el.tagName}: ${style.slice(0, 80)}`);
      }
    });

    expect(violations).toHaveLength(0);
  });
});

describe("LoginScreen — copy hygiene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does not render trust badge chips (redundant with privacy note)", async () => {
    const { default: LoginScreen } = await import("../../src/LoginScreen");
    render(<LoginScreen />);

    // These badges duplicated the left-panel privacy note
    expect(screen.queryByText("End-to-end encrypted")).not.toBeInTheDocument();
    expect(screen.queryByText("No lock-in")).not.toBeInTheDocument();
    expect(screen.queryByText("Export anytime")).not.toBeInTheDocument();
  });

  it("feature list has 3 or fewer items", async () => {
    const { default: LoginScreen } = await import("../../src/LoginScreen");
    const { container } = render(<LoginScreen />);
    // Feature items each have a label div with font-weight 600
    // We check the FEATURES constant by looking for the list container's children
    const featureItems = container.querySelectorAll(".login-feature-item");
    expect(featureItems.length).toBeLessThanOrEqual(3);
  });
});
