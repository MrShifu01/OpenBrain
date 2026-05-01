import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DesignThemeProvider } from "../../design/DesignThemeContext";
import MobileMoreMenu from "../MobileMoreMenu";

// MobileMoreMenu is now a Radix Sheet — content portals to document.body and
// only renders when open. Visibility is governed by Radix' open state, not
// translate-* classes. The component reads design tokens via useDesignTheme
// so the provider has to wrap each render.
function renderMenu(ui: React.ReactElement) {
  return render(<DesignThemeProvider>{ui}</DesignThemeProvider>);
}

describe("MobileMoreMenu", () => {
  it("does not render content when closed", () => {
    renderMenu(<MobileMoreMenu isOpen={false} onNavigate={vi.fn()} />);
    expect(screen.queryByText("Vault")).toBeNull();
  });

  it("renders content when open", () => {
    renderMenu(<MobileMoreMenu isOpen={true} onNavigate={vi.fn()} />);
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("calls onNavigate with 'vault' when Vault button is clicked", () => {
    const onNavigate = vi.fn();
    renderMenu(<MobileMoreMenu isOpen={true} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Vault"));
    expect(onNavigate).toHaveBeenCalledWith("vault");
  });

  it("calls onNavigate with 'settings' when Settings button is clicked", () => {
    const onNavigate = vi.fn();
    renderMenu(<MobileMoreMenu isOpen={true} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Settings"));
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("calls onNavigate with 'close' when sheet is dismissed", () => {
    const onNavigate = vi.fn();
    renderMenu(<MobileMoreMenu isOpen={true} onNavigate={onNavigate} />);
    // Pressing Escape triggers Radix' onOpenChange(false), which our wrapper
    // forwards as onNavigate("close").
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onNavigate).toHaveBeenCalledWith("close");
  });
});
