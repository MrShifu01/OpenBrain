import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: { auth: { signOut: mockSignOut } },
}));

import AccountTab from "../../settings/AccountTab";

describe("AccountTab", () => {
  it("displays the user email", () => {
    render(<AccountTab email="user@example.com" />);
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("calls supabase.auth.signOut when Sign out is clicked", () => {
    render(<AccountTab email="user@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});
