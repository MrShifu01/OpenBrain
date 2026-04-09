import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: vi.fn().mockReturnValue({ upsert: vi.fn() }),
  },
}));

import {
  getUserApiKey,
  setUserApiKey,
  getUserModel,
  setUserModel,
  getUserProvider,
  setUserProvider,
  getOpenRouterKey,
  setOpenRouterKey,
  getOpenRouterModel,
  setOpenRouterModel,
  getGroqKey,
  setGroqKey,
  getEmbedProvider,
  setEmbedProvider,
  getEmbedOpenAIKey,
  setEmbedOpenAIKey,
  getGeminiKey,
  setGeminiKey,
  getEmbedKey,
  getEmbedHeaders,
  getModelForTask,
  _resetForTests,
} from "../../src/lib/aiSettings";

describe("aiFetch settings", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetForTests();
  });

  it("getUserApiKey returns null by default", () => {
    expect(getUserApiKey()).toBeNull();
  });

  it("setUserApiKey stores and retrieves key", () => {
    setUserApiKey("sk-test-123");
    expect(getUserApiKey()).toBe("sk-test-123");
  });

  it("setUserApiKey(null) removes key", () => {
    setUserApiKey("sk-test-123");
    setUserApiKey(null);
    expect(getUserApiKey()).toBeNull();
  });

  it("getUserModel returns default model when not set", () => {
    const model = getUserModel();
    expect(typeof model).toBe("string");
    expect(model.length).toBeGreaterThan(0);
  });

  it("setUserModel stores and retrieves model", () => {
    setUserModel("claude-sonnet-4-6");
    expect(getUserModel()).toBe("claude-sonnet-4-6");
  });

  it("getUserProvider defaults to openrouter", () => {
    expect(getUserProvider()).toBe("openrouter");
  });

  it("setUserProvider stores provider", () => {
    setUserProvider("openrouter");
    expect(getUserProvider()).toBe("openrouter");
  });

  it("getOpenRouterKey returns null by default", () => {
    expect(getOpenRouterKey()).toBeNull();
  });

  it("setOpenRouterKey stores key", () => {
    setOpenRouterKey("or-key");
    expect(getOpenRouterKey()).toBe("or-key");
  });

  it("getOpenRouterModel returns null by default", () => {
    expect(getOpenRouterModel()).toBeNull();
  });

  it("setOpenRouterModel stores model", () => {
    setOpenRouterModel("google/gemini-2.0-flash-exp:free");
    expect(getOpenRouterModel()).toBe("google/gemini-2.0-flash-exp:free");
  });

  it("getGroqKey returns null by default", () => {
    expect(getGroqKey()).toBeNull();
  });

  it("setGroqKey stores key", () => {
    setGroqKey("gsk-test");
    expect(getGroqKey()).toBe("gsk-test");
  });

  it("getEmbedProvider defaults to google", () => {
    expect(getEmbedProvider()).toBe("google");
  });

  it("setEmbedProvider stores provider", () => {
    setEmbedProvider("google");
    expect(getEmbedProvider()).toBe("google");
  });

  it("getEmbedOpenAIKey returns null by default", () => {
    expect(getEmbedOpenAIKey()).toBeNull();
  });

  it("setEmbedOpenAIKey stores key", () => {
    setEmbedOpenAIKey("embed-key");
    expect(getEmbedOpenAIKey()).toBe("embed-key");
  });

  it("getGeminiKey returns null by default", () => {
    expect(getGeminiKey()).toBeNull();
  });

  it("setGeminiKey stores key", () => {
    setGeminiKey("gemini-key");
    expect(getGeminiKey()).toBe("gemini-key");
  });

  it("getEmbedKey returns google key by default", () => {
    setGeminiKey("gem-key");
    expect(getEmbedKey()).toBe("gem-key");
  });

  it("getEmbedKey returns google key when provider is google", () => {
    setEmbedProvider("google");
    setGeminiKey("gem-key");
    expect(getEmbedKey()).toBe("gem-key");
  });

  it("getEmbedHeaders returns null when no key set", () => {
    expect(getEmbedHeaders()).toBeNull();
  });

  it("getEmbedHeaders returns headers when key is set", () => {
    setGeminiKey("gem-key");
    const headers = getEmbedHeaders();
    expect(headers).toEqual({ "X-Embed-Provider": "google", "X-Embed-Key": "gem-key" });
  });

  it("getModelForTask returns null by default", () => {
    expect(getModelForTask("capture")).toBeNull();
  });
});

describe("aiFetch function", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("calls authFetch without X-User-Api-Key header when no key is stored", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const { aiFetch } = await import("../../src/lib/aiFetch");
    // Ensure no key is stored
    localStorage.clear();
    await aiFetch("/api/test", { method: "POST" });

    // authFetch calls fetch internally; check that no X-User-Api-Key was injected
    const calledHeaders = mockFetch.mock.calls[0]?.[1]?.headers ?? {};
    expect(calledHeaders["X-User-Api-Key"]).toBeUndefined();
  });

  it("injects X-User-Api-Key header when user key is stored", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const { setUserApiKey } = await import("../../src/lib/aiSettings");
    const { aiFetch } = await import("../../src/lib/aiFetch");
    setUserApiKey("sk-mykey");
    await aiFetch("/api/test", { method: "POST" });

    const calledHeaders = mockFetch.mock.calls[0]?.[1]?.headers ?? {};
    expect(calledHeaders["X-User-Api-Key"]).toBe("sk-mykey");
  });
});
