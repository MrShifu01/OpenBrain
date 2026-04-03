/**
 * callAI — unified AI call that routes to the right endpoint based on
 * the user's configured provider (anthropic | openai | openrouter).
 *
 * Usage:
 *   import { callAI } from "../lib/ai";
 *   const res = await callAI({ messages, system, max_tokens: 600 });
 *   const data = await res.json();
 *   const text = data.content?.[0]?.text;
 *
 * All three endpoints normalize their response to Anthropic shape:
 *   { content: [{ type: "text", text: "..." }] }
 */
import { authFetch } from "./authFetch";
import {
  getUserProvider,
  getUserModel,
  getUserApiKey,
  getOpenRouterKey,
  getOpenRouterModel,
  getModelForTask,
} from "./aiFetch";

const ENDPOINT = {
  anthropic:   "/api/anthropic",
  openai:      "/api/openai",
  openrouter:  "/api/openrouter",
};

/**
 * Convert Anthropic-format image blocks to OpenAI/OpenRouter format.
 * Anthropic: { type:"image", source:{ type:"base64", media_type, data } }
 * OpenAI:    { type:"image_url", image_url:{ url:"data:<mime>;base64,<data>" } }
 * Anthropic format is the canonical form used throughout the codebase.
 */
function normalizeMessages(messages, provider) {
  if (provider === "anthropic") return messages;
  return messages.map((msg) => {
    if (!Array.isArray(msg.content)) return msg;
    return {
      ...msg,
      content: msg.content.map((block) => {
        if (block.type === "image" && block.source?.type === "base64") {
          return {
            type: "image_url",
            image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
          };
        }
        return block;
      }),
    };
  });
}

export async function callAI({ messages, system, max_tokens, memoryGuide, task } = {}) {
  const provider = getUserProvider();
  const endpoint = ENDPOINT[provider] ?? ENDPOINT.anthropic;

  // Pick model based on provider — task-specific model takes priority when set
  let model;
  if (provider === "openrouter") {
    model = (task ? getModelForTask(task) : null) || getOpenRouterModel() || "google/gemini-2.0-flash-exp:free";
  } else {
    model = getUserModel();
  }

  // Pick key based on provider
  let userKey;
  if (provider === "openrouter") {
    userKey = getOpenRouterKey();
  } else {
    userKey = getUserApiKey();
  }

  // Inject memory guide into system prompt if provided
  const fullSystem = memoryGuide
    ? `[Classification Guide]\n${memoryGuide}\n\n[Task]\n${system || ""}`
    : system;

  const headers = {
    "Content-Type": "application/json",
    ...(userKey ? { "X-User-Api-Key": userKey } : {}),
  };

  return authFetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: normalizeMessages(messages, provider),
      system: fullSystem,
      max_tokens,
    }),
  });
}
