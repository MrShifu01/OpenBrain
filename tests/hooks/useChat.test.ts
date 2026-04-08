import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../../src/lib/authFetch", () => ({
  authFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));
vi.mock("../../src/lib/ai", () => ({
  callAI: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));
vi.mock("../../src/lib/aiSettings", () => ({
  getEmbedHeaders: vi.fn().mockReturnValue(null),
  getUserProvider: vi.fn().mockReturnValue("anthropic"),
  getUserModel: vi.fn().mockReturnValue("claude-3-haiku"),
  getUserApiKey: vi.fn().mockReturnValue(null),
  getOpenRouterKey: vi.fn().mockReturnValue(null),
  getOpenRouterModel: vi.fn().mockReturnValue(null),
}));
vi.mock("../../src/lib/chatContext", () => ({
  scoreEntriesForQuery: vi.fn().mockReturnValue([]),
}));
vi.mock("../../src/lib/extractNudgeText", () => ({
  extractNudgeText: vi.fn().mockReturnValue(null),
}));
vi.mock("../../src/lib/pin", () => ({
  getStoredPinHash: vi.fn().mockReturnValue(null),
}));

import { useChat } from "../../src/hooks/useChat";

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default assistant greeting message", () => {
    const { result } = renderHook(() =>
      useChat({
        entries: [],
        activeBrain: null,
        brains: [],
        links: [],
        cryptoKey: null,
        handleVaultUnlock: vi.fn(),
        vaultExists: false,
      }),
    );
    expect(result.current.chatMsgs).toHaveLength(1);
    expect(result.current.chatMsgs[0].role).toBe("assistant");
  });

  it("chatLoading starts as false", () => {
    const { result } = renderHook(() =>
      useChat({
        entries: [],
        activeBrain: null,
        brains: [],
        links: [],
        cryptoKey: null,
        handleVaultUnlock: vi.fn(),
        vaultExists: false,
      }),
    );
    expect(result.current.chatLoading).toBe(false);
  });

  it("chatInput starts empty", () => {
    const { result } = renderHook(() =>
      useChat({
        entries: [],
        activeBrain: null,
        brains: [],
        links: [],
        cryptoKey: null,
        handleVaultUnlock: vi.fn(),
        vaultExists: false,
      }),
    );
    expect(result.current.chatInput).toBe("");
  });

  it("showPinGate starts false", () => {
    const { result } = renderHook(() =>
      useChat({
        entries: [],
        activeBrain: null,
        brains: [],
        links: [],
        cryptoKey: null,
        handleVaultUnlock: vi.fn(),
        vaultExists: false,
      }),
    );
    expect(result.current.showPinGate).toBe(false);
  });
});
