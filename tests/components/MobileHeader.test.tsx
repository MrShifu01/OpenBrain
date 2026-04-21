import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../src/ThemeContext";
import { DesignThemeProvider } from "../../src/design/DesignThemeContext";
import MobileHeader from "../../src/components/MobileHeader";

// Redesigned mobile header — 36px touch targets (min-height: 36px inline),
// serif brand with a coloured status dot, no text "Offline/Syncing" label.
function renderWithTheme(ui: React.ReactElement) {
  return render(
    <DesignThemeProvider>
      <ThemeProvider>{ui}</ThemeProvider>
    </DesignThemeProvider>,
  );
}

describe("MobileHeader", () => {
  const defaultProps = {
    brainName: "Personal",
    brainEmoji: "\uD83E\uDDE0",
    onToggleTheme: vi.fn(),
    isDark: true,
    isOnline: true,
    pendingCount: 0,
  };

  it("renders the Everion brand", () => {
    renderWithTheme(<MobileHeader {...defaultProps} />);
    expect(screen.getByText("Everion")).toBeInTheDocument();
  });

  it("renders a header element with banner role", () => {
    renderWithTheme(<MobileHeader {...defaultProps} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("shows an offline status indicator when offline", () => {
    renderWithTheme(<MobileHeader {...defaultProps} isOnline={false} />);
    const dot = screen.getByTitle(/offline/i);
    expect(dot).toBeInTheDocument();
  });

  it("shows a pending status indicator when online with pending changes", () => {
    renderWithTheme(<MobileHeader {...defaultProps} pendingCount={3} />);
    expect(screen.getByTitle(/pending/i)).toBeInTheDocument();
  });

  it("shows a synced status indicator when online and nothing pending", () => {
    renderWithTheme(<MobileHeader {...defaultProps} isOnline={true} pendingCount={0} />);
    expect(screen.getByTitle(/synced/i)).toBeInTheDocument();
  });
});
