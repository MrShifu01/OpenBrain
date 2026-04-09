import { describe, it, expect, vi, beforeEach } from "vitest";

// Must mock before importing the module under test
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }),
  },
}));

vi.mock("../../src/data/constants", () => ({ MODEL: "claude-sonnet-4-6" }));

import {
  getUserApiKey,
  setUserApiKey,
  getOpenRouterKey,
  setOpenRouterKey,
  getGroqKey,
  setGroqKey,
  getEmbedOpenAIKey,
  setEmbedOpenAIKey,
  getGeminiKey,
  setGeminiKey,
  getUserModel,
  setUserModel,
  getUserProvider,
  setUserProvider,
  loadUserAISettings,
  _resetForTests,
} from "../../src/lib/aiSettings";
import { KEYS } from "../../src/lib/storageKeys";

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
});

// ── Sensitive keys live in memory, NOT localStorage ──────────────────────────

describe("getUserApiKey / setUserApiKey", () => {
  it("returns null when nothing set", () => {
    expect(getUserApiKey()).toBeNull();
  });

  it("set then get returns value", () => {
    setUserApiKey("sk-test-123");
    expect(getUserApiKey()).toBe("sk-test-123");
  });

  it("value NOT written to localStorage", () => {
    setUserApiKey("sk-test-123");
    expect(localStorage.getItem(KEYS.AI_API_KEY)).toBeNull();
  });

  it("set null clears memory", () => {
    setUserApiKey("sk-test-123");
    setUserApiKey(null);
    expect(getUserApiKey()).toBeNull();
  });
});

describe("getOpenRouterKey / setOpenRouterKey", () => {
  it("returns null when nothing set", () => {
    expect(getOpenRouterKey()).toBeNull();
  });

  it("set then get returns value", () => {
    setOpenRouterKey("or-key-abc");
    expect(getOpenRouterKey()).toBe("or-key-abc");
  });

  it("value NOT written to localStorage", () => {
    setOpenRouterKey("or-key-abc");
    expect(localStorage.getItem(KEYS.OPENROUTER_KEY)).toBeNull();
  });
});

describe("getGroqKey / setGroqKey", () => {
  it("returns null when nothing set", () => {
    expect(getGroqKey()).toBeNull();
  });

  it("set then get returns value", () => {
    setGroqKey("gsk-abc");
    expect(getGroqKey()).toBe("gsk-abc");
  });

  it("value NOT written to localStorage", () => {
    setGroqKey("gsk-abc");
    expect(localStorage.getItem(KEYS.GROQ_KEY)).toBeNull();
  });
});

describe("getEmbedOpenAIKey / setEmbedOpenAIKey", () => {
  it("returns null when nothing set", () => {
    expect(getEmbedOpenAIKey()).toBeNull();
  });

  it("set then get returns value", () => {
    setEmbedOpenAIKey("sk-embed-xyz");
    expect(getEmbedOpenAIKey()).toBe("sk-embed-xyz");
  });

  it("value NOT written to localStorage", () => {
    setEmbedOpenAIKey("sk-embed-xyz");
    expect(localStorage.getItem(KEYS.EMBED_OPENAI_KEY)).toBeNull();
  });
});

describe("getGeminiKey / setGeminiKey", () => {
  it("returns null when nothing set", () => {
    expect(getGeminiKey()).toBeNull();
  });

  it("set then get returns value", () => {
    setGeminiKey("AIza-gem-key");
    expect(getGeminiKey()).toBe("AIza-gem-key");
  });

  it("value NOT written to localStorage", () => {
    setGeminiKey("AIza-gem-key");
    expect(localStorage.getItem(KEYS.GEMINI_KEY)).toBeNull();
  });
});

// ── Non-sensitive settings still use localStorage ─────────────────────────────

describe("getUserModel / setUserModel", () => {
  it("returns default model when nothing set", () => {
    expect(getUserModel()).toBe("claude-sonnet-4-6");
  });

  it("persists in localStorage", () => {
    setUserModel("gpt-4o");
    expect(localStorage.getItem(KEYS.AI_MODEL)).toBe("gpt-4o");
  });
});

describe("getUserProvider / setUserProvider", () => {
  it("returns anthropic by default", () => {
    expect(getUserProvider()).toBe("anthropic");
  });

  it("persists in localStorage", () => {
    setUserProvider("openai");
    expect(localStorage.getItem(KEYS.AI_PROVIDER)).toBe("openai");
  });
});

// ── loadUserAISettings writes keys to memory, clears from localStorage ────────

describe("loadUserAISettings", () => {
  it("populates memory from Supabase data", async () => {
    const { supabase } = await import("../../src/lib/supabase");
    vi.mocked(supabase.from("").select("").eq("", "").single).mockResolvedValueOnce({
      data: {
        api_key: "sk-from-db",
        openrouter_key: "or-from-db",
        groq_key: "gsk-from-db",
        embed_openai_key: "sk-embed-from-db",
        gemini_key: "AIza-from-db",
        ai_model: "claude-3-5-sonnet",
        ai_provider: "anthropic",
        openrouter_model: null,
        embed_provider: "openai",
      },
    } as any);

    await loadUserAISettings("user-123");

    expect(getUserApiKey()).toBe("sk-from-db");
    expect(getOpenRouterKey()).toBe("or-from-db");
    expect(getGroqKey()).toBe("gsk-from-db");
    expect(getEmbedOpenAIKey()).toBe("sk-embed-from-db");
    expect(getGeminiKey()).toBe("AIza-from-db");
  });

  it("clears any key values lingering in localStorage after load", async () => {
    // Simulate old keys in localStorage before migration
    localStorage.setItem(KEYS.AI_API_KEY, "old-ls-key");
    localStorage.setItem(KEYS.OPENROUTER_KEY, "old-or-key");
    localStorage.setItem(KEYS.GROQ_KEY, "old-groq-key");
    localStorage.setItem(KEYS.EMBED_OPENAI_KEY, "old-embed-key");
    localStorage.setItem(KEYS.GEMINI_KEY, "old-gem-key");

    const { supabase } = await import("../../src/lib/supabase");
    vi.mocked(supabase.from("").select("").eq("", "").single).mockResolvedValueOnce({
      data: {
        api_key: "sk-from-db",
        openrouter_key: null,
        groq_key: null,
        embed_openai_key: null,
        gemini_key: null,
        ai_model: null,
        ai_provider: "anthropic",
        openrouter_model: null,
        embed_provider: "openai",
      },
    } as any);

    await loadUserAISettings("user-123");

    expect(localStorage.getItem(KEYS.AI_API_KEY)).toBeNull();
    expect(localStorage.getItem(KEYS.OPENROUTER_KEY)).toBeNull();
    expect(localStorage.getItem(KEYS.GROQ_KEY)).toBeNull();
    expect(localStorage.getItem(KEYS.EMBED_OPENAI_KEY)).toBeNull();
    expect(localStorage.getItem(KEYS.GEMINI_KEY)).toBeNull();
  });

  it("migrates pre-existing localStorage keys to memory on load", async () => {
    // Old key sitting in localStorage (pre-migration user)
    localStorage.setItem(KEYS.AI_API_KEY, "sk-legacy");

    const { supabase } = await import("../../src/lib/supabase");
    vi.mocked(supabase.from("").select("").eq("", "").single).mockResolvedValueOnce({
      data: null, // no Supabase record yet
    } as any);

    await loadUserAISettings("user-legacy");

    // Key moved to memory from localStorage
    expect(getUserApiKey()).toBe("sk-legacy");
    // Cleared from localStorage
    expect(localStorage.getItem(KEYS.AI_API_KEY)).toBeNull();
  });
});
