import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are initialized before vi.mock factories run
const { mockUpsert, mockSingle, mockEq, mockSelect, mockFrom } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert, select: mockSelect }));
  return { mockUpsert, mockSingle, mockEq, mockSelect, mockFrom };
});

vi.mock("../supabase", () => ({ supabase: { from: mockFrom } }));
vi.mock("../../data/constants", () => ({ MODEL: "claude-haiku" }));

import {
  setUserApiKey, getUserApiKey,
  setGroqKey, getGroqKey,
  setGeminiKey, getGeminiKey,
  setEmbedOpenAIKey, getEmbedOpenAIKey,
  setUserProvider, getUserProvider,
  setUserModel, getUserModel,
  setOpenRouterKey, getOpenRouterKey,
  setOpenRouterModel, getOpenRouterModel,
  setEmbedProvider, getEmbedProvider,
  loadUserAISettings,
} from "../aiSettings";

const AUTH_KEY = "sb-test-auth-token";
const USER_ID = "uid-123";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AUTH_KEY, JSON.stringify({ user: { id: USER_ID } }));
  mockFrom.mockClear();
  mockUpsert.mockClear();
  mockSelect.mockClear();
  mockEq.mockClear();
  mockSingle.mockClear();
});

// ── localStorage writes ──────────────────────────────────────────

describe("localStorage writes", () => {
  it("setUserApiKey stores key", () => {
    setUserApiKey("sk-ant-test");
    expect(getUserApiKey()).toBe("sk-ant-test");
  });

  it("setUserApiKey(null) removes key", () => {
    localStorage.setItem("openbrain_api_key", "old");
    setUserApiKey(null);
    expect(getUserApiKey()).toBeNull();
  });

  it("setGroqKey stores key", () => {
    setGroqKey("gsk_test");
    expect(getGroqKey()).toBe("gsk_test");
  });

  it("setGeminiKey stores key", () => {
    setGeminiKey("AIza_test");
    expect(getGeminiKey()).toBe("AIza_test");
  });

  it("setEmbedOpenAIKey stores key", () => {
    setEmbedOpenAIKey("sk-embed");
    expect(getEmbedOpenAIKey()).toBe("sk-embed");
  });

  it("setUserProvider stores provider", () => {
    setUserProvider("openai");
    expect(getUserProvider()).toBe("openai");
  });

  it("setUserModel stores model", () => {
    setUserModel("claude-opus-4");
    expect(getUserModel()).toBe("claude-opus-4");
  });

  it("setOpenRouterKey stores key", () => {
    setOpenRouterKey("sk-or-test");
    expect(getOpenRouterKey()).toBe("sk-or-test");
  });

  it("setOpenRouterModel stores model", () => {
    setOpenRouterModel("google/gemini-flash");
    expect(getOpenRouterModel()).toBe("google/gemini-flash");
  });

  it("setEmbedProvider stores provider", () => {
    setEmbedProvider("google");
    expect(getEmbedProvider()).toBe("google");
  });
});

// ── Supabase upsert calls ────────────────────────────────────────

describe("Supabase upsert on set", () => {
  it("setUserApiKey calls upsert with api_key", () => {
    setUserApiKey("sk-ant-test");
    expect(mockFrom).toHaveBeenCalledWith("user_ai_settings");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, api_key: "sk-ant-test" }),
      { onConflict: "user_id" },
    );
  });

  it("setUserApiKey(null) upserts api_key: null", () => {
    setUserApiKey(null);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, api_key: null }),
      { onConflict: "user_id" },
    );
  });

  it("setGroqKey calls upsert with groq_key", () => {
    setGroqKey("gsk_test");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, groq_key: "gsk_test" }),
      { onConflict: "user_id" },
    );
  });

  it("setGeminiKey calls upsert with gemini_key", () => {
    setGeminiKey("AIza_test");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, gemini_key: "AIza_test" }),
      { onConflict: "user_id" },
    );
  });

  it("setEmbedOpenAIKey calls upsert with embed_openai_key", () => {
    setEmbedOpenAIKey("sk-embed");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, embed_openai_key: "sk-embed" }),
      { onConflict: "user_id" },
    );
  });

  it("setUserProvider calls upsert with ai_provider", () => {
    setUserProvider("openai");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, ai_provider: "openai" }),
      { onConflict: "user_id" },
    );
  });

  it("setUserModel calls upsert with ai_model", () => {
    setUserModel("claude-opus-4");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, ai_model: "claude-opus-4" }),
      { onConflict: "user_id" },
    );
  });

  it("setOpenRouterKey calls upsert with openrouter_key", () => {
    setOpenRouterKey("sk-or-test");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, openrouter_key: "sk-or-test" }),
      { onConflict: "user_id" },
    );
  });

  it("setOpenRouterModel calls upsert with openrouter_model", () => {
    setOpenRouterModel("google/gemini-flash");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, openrouter_model: "google/gemini-flash" }),
      { onConflict: "user_id" },
    );
  });

  it("setEmbedProvider calls upsert with embed_provider", () => {
    setEmbedProvider("google");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, embed_provider: "google" }),
      { onConflict: "user_id" },
    );
  });

  it("does not call upsert when no user id in localStorage", () => {
    localStorage.clear();
    setUserApiKey("sk-ant-test");
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

// ── loadUserAISettings ───────────────────────────────────────────

describe("loadUserAISettings", () => {
  it("populates localStorage from Supabase row", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        api_key: "sk-from-db",
        ai_model: "claude-opus-4",
        ai_provider: "anthropic",
        openrouter_key: "sk-or-db",
        openrouter_model: "google/gemini-flash",
        groq_key: "gsk_db",
        embed_provider: "google",
        embed_openai_key: "sk-embed-db",
        gemini_key: "AIza_db",
        model_capture: "fast-model",
        model_questions: null,
        model_vision: null,
        model_refine: null,
        model_chat: null,
      },
      error: null,
    });

    await loadUserAISettings(USER_ID);

    expect(getUserApiKey()).toBe("sk-from-db");
    expect(getUserModel()).toBe("claude-opus-4");
    expect(getUserProvider()).toBe("anthropic");
    expect(getOpenRouterKey()).toBe("sk-or-db");
    expect(getGroqKey()).toBe("gsk_db");
    expect(getGeminiKey()).toBe("AIza_db");
    expect(getEmbedProvider()).toBe("google");
    expect(getEmbedOpenAIKey()).toBe("sk-embed-db");
    expect(localStorage.getItem("openbrain_task_capture")).toBe("fast-model");
  });

  it("does nothing when Supabase returns null data", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    await loadUserAISettings(USER_ID);
    expect(getUserApiKey()).toBeNull();
  });
});
