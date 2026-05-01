import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../src/ThemeContext";
import { DesignThemeProvider } from "../../src/design/DesignThemeContext";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import MobileHeader from "../../src/components/MobileHeader";

// Redesigned mobile header — 36px touch targets (min-height: 36px inline),
// serif brand with a coloured status dot, no text "Offline/Syncing" label.
// TooltipProvider wraps the tree because MobileHeader's search + menu
// buttons are inside <Tooltip> primitives that throw without a provider.
function renderWithTheme(ui: React.ReactElement) {
  return render(
    <DesignThemeProvider>
      <ThemeProvider>
        <TooltipProvider>{ui}</TooltipProvider>
      </ThemeProvider>
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

  // The redesign moved network status out of MobileHeader (now in
  // OnlineIndicator on the global app frame). isOnline/pendingCount remain
  // in the prop contract for API compat but are intentionally unused here,
  // so the previous status-dot tests no longer apply.
});
