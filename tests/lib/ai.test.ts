import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/aiSettings", () => ({
  getUserProvider: vi.fn().mockReturnValue("anthropic"),
  getUserModel:    vi.fn().mockReturnValue("claude-sonnet-4-6"),
  getUserApiKey:   vi.fn().mockReturnValue(null),
  getOpenRouterKey:   vi.fn().mockReturnValue(null),
  getOpenRouterModel: vi.fn().mockReturnValue(null),
  getModelForTask:    vi.fn().mockReturnValue(null),
}));

vi.mock("../../src/lib/systemPromptBuilder", () => ({
  buildSystemPrompt: vi.fn().mockReturnValue(""),
}));

vi.mock("../../src/lib/authFetch", () => ({
  authFetch: vi.fn(),
}));

import { getUserProvider } from "../../src/lib/aiSettings";
import { authFetch } from "../../src/lib/authFetch";
import { callAI } from "../../src/lib/ai";

const mockGetProvider = getUserProvider as ReturnType<typeof vi.fn>;
const mockAuthFetch = authFetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthFetch.mockResolvedValue(new Response("{}", { status: 200 }));
});

describe("callAI endpoint routing", () => {
  it("routes anthropic provider to /api/llm?provider=anthropic", async () => {
    mockGetProvider.mockReturnValue("anthropic");
    await callAI({ messages: [{ role: "user", content: "hi" }] });
    const [url] = mockAuthFetch.mock.calls[0];
    expect(url).toBe("/api/llm?provider=anthropic");
  });

  it("routes openai provider to /api/llm?provider=openai", async () => {
    mockGetProvider.mockReturnValue("openai");
    await callAI({ messages: [{ role: "user", content: "hi" }] });
    const [url] = mockAuthFetch.mock.calls[0];
    expect(url).toBe("/api/llm?provider=openai");
  });

  it("routes openrouter provider to /api/llm?provider=openrouter", async () => {
    mockGetProvider.mockReturnValue("openrouter");
    await callAI({ messages: [{ role: "user", content: "hi" }] });
    const [url] = mockAuthFetch.mock.calls[0];
    expect(url).toBe("/api/llm?provider=openrouter");
  });

  it("defaults to anthropic for unknown provider", async () => {
    mockGetProvider.mockReturnValue("unknown-provider");
    await callAI({ messages: [{ role: "user", content: "hi" }] });
    const [url] = mockAuthFetch.mock.calls[0];
    expect(url).toBe("/api/llm?provider=anthropic");
  });
});

describe("callAI message normalisation", () => {
  it("unknown provider uses anthropic message format (no transformation)", async () => {
    mockGetProvider.mockReturnValue("badprovider");
    const imageMessage = {
      role: "user",
      content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "abc" } }],
    };
    await callAI({ messages: [imageMessage] });
    // The body should contain the original Anthropic-style block, not the OpenAI url format
    const body = JSON.parse(mockAuthFetch.mock.calls[0][1].body);
    expect(body.messages[0].content[0].type).toBe("image");
    expect(body.messages[0].content[0].source).toBeDefined();
    expect(body.messages[0].content[0].image_url).toBeUndefined();
  });
});
