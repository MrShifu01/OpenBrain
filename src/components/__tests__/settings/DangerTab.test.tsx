import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DangerTab from "../../settings/DangerTab";
import type { Brain } from "../../../types";

const brain: Brain = { id: "b1", name: "Test Brain", myRole: "owner" };

describe("DangerTab", () => {
  it("renders the delete button", () => {
    render(<DangerTab activeBrain={brain} deleteBrain={vi.fn()} />);
    expect(screen.getByRole("button", { name: /delete this brain/i })).toBeInTheDocument();
  });

  it("shows confirm text after first click", () => {
    render(<DangerTab activeBrain={brain} deleteBrain={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete this brain/i }));
    expect(screen.getByText(/tap again to confirm/i)).toBeInTheDocument();
  });

  it("calls deleteBrain on second click", async () => {
    const deleteBrain = vi.fn().mockResolvedValue(undefined);
    render(<DangerTab activeBrain={brain} deleteBrain={deleteBrain} />);
    fireEvent.click(screen.getByRole("button", { name: /delete this brain/i }));
    fireEvent.click(screen.getByRole("button", { name: /tap again/i }));
    expect(deleteBrain).toHaveBeenCalledWith("b1");
  });
});
