import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import ChatView from "../ChatView";

const baseProps = {
  chatMsgs: [{ role: "assistant", content: "Hello!" }],
  chatLoading: false,
  chatInput: "",
  setChatInput: vi.fn(),
  searchAllBrains: false,
  setSearchAllBrains: vi.fn(),
  handleChat: vi.fn(),
  vaultUnlockModal: null,
  setVaultUnlockModal: vi.fn(),
  vaultModalInput: "",
  setVaultModalInput: vi.fn(),
  vaultModalMode: "passphrase" as const,
  setVaultModalMode: vi.fn(),
  vaultModalError: "",
  vaultModalBusy: false,
  handleVaultModalUnlock: vi.fn(),
  chatEndRef: createRef<HTMLDivElement>(),
  brains: [],
  phoneRegex: /(\+27|0)[6-8][0-9]{8}/g,
};

describe("ChatView — accessibility", () => {
  it("messages container has aria-live=polite so screen readers announce new messages", () => {
    const { container } = render(<ChatView {...baseProps} />);
    const liveRegion = container.querySelector("[aria-live]");
    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-atomic", "false");
  });
});
