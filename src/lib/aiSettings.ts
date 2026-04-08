import { supabase } from "./supabase";
import { MODEL as DEFAULT_MODEL } from "../data/constants";
import { KEYS } from "./storageKeys";

// ── Key migration (run once at module init) ──
try {
  const key = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"));
  if (key) {
    const data = JSON.parse(localStorage.getItem(key)!);
    const uid: string | null = data?.user?.id || null;
    if (uid) {
      for (const suffix of [
        "api_key", "model", "provider", "openrouter_key",
        "openrouter_model", "embed_provider", "embed_openai_key", "gemini_key",
        "groq_key",
      ]) {
        const oldKey = `openbrain_${uid}_${suffix}`;
        const newKey = `openbrain_${suffix}`;
        if (!localStorage.getItem(newKey) && localStorage.getItem(oldKey)) {
          localStorage.setItem(newKey, localStorage.getItem(oldKey)!);
        }
      }
    }
  }
} catch { /* ignore */ }

export function getUserId(): string | null {
  try {
    const key = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"));
    if (key) {
      const data = JSON.parse(localStorage.getItem(key)!);
      return data?.user?.id || null;
    }
  } catch { /* ignore */ }
  return null;
}

// ── Internal helper: fire-and-forget Supabase upsert ──
function syncToSupabase(fields: Record<string, string | null>): void {
  const uid = getUserId();
  if (!uid) return;
  supabase
    .from("user_ai_settings")
    .upsert(
      { user_id: uid, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
}

// ── Primary AI provider ──
export function getUserApiKey(): string | null {
  return localStorage.getItem(KEYS.AI_API_KEY) || null;
}
export function setUserApiKey(key: string | null): void {
  if (key) localStorage.setItem(KEYS.AI_API_KEY, key);
  else localStorage.removeItem(KEYS.AI_API_KEY);
  syncToSupabase({ api_key: key || null });
}

export function getUserModel(): string {
  return localStorage.getItem(KEYS.AI_MODEL) || DEFAULT_MODEL;
}
export function setUserModel(model: string | null): void {
  if (model) localStorage.setItem(KEYS.AI_MODEL, model);
  else localStorage.removeItem(KEYS.AI_MODEL);
  syncToSupabase({ ai_model: model || null });
}

export function getUserProvider(): string {
  return localStorage.getItem(KEYS.AI_PROVIDER) || "anthropic";
}
export function setUserProvider(provider: string | null): void {
  localStorage.setItem(KEYS.AI_PROVIDER, provider || "anthropic");
  syncToSupabase({ ai_provider: provider || "anthropic" });
}

// ── OpenRouter ──
export function getOpenRouterKey(): string | null {
  return localStorage.getItem(KEYS.OPENROUTER_KEY) || null;
}
export function setOpenRouterKey(key: string | null): void {
  if (key) localStorage.setItem(KEYS.OPENROUTER_KEY, key);
  else localStorage.removeItem(KEYS.OPENROUTER_KEY);
  syncToSupabase({ openrouter_key: key || null });
}

export function getOpenRouterModel(): string | null {
  return localStorage.getItem(KEYS.OPENROUTER_MODEL) || null;
}
export function setOpenRouterModel(model: string | null): void {
  if (model) localStorage.setItem(KEYS.OPENROUTER_MODEL, model);
  else localStorage.removeItem(KEYS.OPENROUTER_MODEL);
  syncToSupabase({ openrouter_model: model || null });
}

// ── Groq ──
export function getGroqKey(): string | null {
  return localStorage.getItem(KEYS.GROQ_KEY) || null;
}
export function setGroqKey(key: string | null): void {
  if (key) localStorage.setItem(KEYS.GROQ_KEY, key);
  else localStorage.removeItem(KEYS.GROQ_KEY);
  syncToSupabase({ groq_key: key || null });
}

// ── Per-task model overrides ──
const TASK_COL: Record<string, string> = {
  capture: "model_capture",
  questions: "model_questions",
  vision: "model_vision",
  refine: "model_refine",
  chat: "model_chat",
};

export function getModelForTask(task: string): string | null {
  return localStorage.getItem(KEYS.taskModel(task)) || null;
}
export function setModelForTask(task: string, model: string | null): void {
  const lsKey = KEYS.taskModel(task);
  if (model) localStorage.setItem(lsKey, model);
  else localStorage.removeItem(lsKey);
  const col = TASK_COL[task];
  if (!col) return;
  syncToSupabase({ [col]: model || null });
}

// ── Load all settings from Supabase into localStorage cache ──
export async function loadUserAISettings(userId: string): Promise<void> {
  const { data } = await supabase
    .from("user_ai_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!data) return;

  const set = (lsKey: string, val: string | null | undefined) => {
    if (val) localStorage.setItem(lsKey, val);
    else localStorage.removeItem(lsKey);
  };

  set(KEYS.AI_API_KEY, data.api_key);
  set(KEYS.AI_MODEL, data.ai_model);
  set(KEYS.AI_PROVIDER, data.ai_provider);
  set(KEYS.OPENROUTER_KEY, data.openrouter_key);
  set(KEYS.OPENROUTER_MODEL, data.openrouter_model);
  set(KEYS.GROQ_KEY, data.groq_key);
  set(KEYS.EMBED_PROVIDER, data.embed_provider);
  set(KEYS.EMBED_OPENAI_KEY, data.embed_openai_key);
  set(KEYS.GEMINI_KEY, data.gemini_key);

  for (const [task, col] of Object.entries(TASK_COL)) {
    set(KEYS.taskModel(task), data[col]);
  }
}

/** @deprecated Use loadUserAISettings instead */
export function loadTaskModels(
  _userId: string,
  settingsRow: Record<string, string | null> | null,
): void {
  if (!settingsRow) return;
  for (const [task, col] of Object.entries(TASK_COL)) {
    const val = settingsRow[col];
    const lsKey = KEYS.taskModel(task);
    if (val) localStorage.setItem(lsKey, val);
    else localStorage.removeItem(lsKey);
  }
}

// ── Embedding settings ──
export function getEmbedProvider(): string {
  return localStorage.getItem(KEYS.EMBED_PROVIDER) || "openai";
}
export function setEmbedProvider(p: string | null): void {
  localStorage.setItem(KEYS.EMBED_PROVIDER, p || "openai");
  syncToSupabase({ embed_provider: p || "openai" });
}

export function getEmbedOpenAIKey(): string | null {
  return localStorage.getItem(KEYS.EMBED_OPENAI_KEY) || null;
}
export function setEmbedOpenAIKey(key: string | null): void {
  if (key) localStorage.setItem(KEYS.EMBED_OPENAI_KEY, key);
  else localStorage.removeItem(KEYS.EMBED_OPENAI_KEY);
  syncToSupabase({ embed_openai_key: key || null });
}

export function getGeminiKey(): string | null {
  return localStorage.getItem(KEYS.GEMINI_KEY) || null;
}
export function setGeminiKey(key: string | null): void {
  if (key) localStorage.setItem(KEYS.GEMINI_KEY, key);
  else localStorage.removeItem(KEYS.GEMINI_KEY);
  syncToSupabase({ gemini_key: key || null });
}

export function getEmbedKey(): string | null {
  return getEmbedProvider() === "google" ? getGeminiKey() : getEmbedOpenAIKey();
}

export function getEmbedHeaders(): { "X-Embed-Provider": string; "X-Embed-Key": string } | null {
  const provider = getEmbedProvider();
  const key = getEmbedKey();
  if (!key) return null;
  return { "X-Embed-Provider": provider, "X-Embed-Key": key };
}
