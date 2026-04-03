// supabase/functions/telegram-webhook/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const OPENROUTER_MODEL = "google/gemini-2.0-flash-exp:free";

async function sendMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

serve(async (req) => {
  try {
    const update = await req.json();

    const chatId: number | undefined = update.message?.chat?.id;
    const text: string | undefined = update.message?.text;

    if (!chatId || !text) return new Response("ok", { status: 200 });

    // Admin client — bypasses RLS so we can look up any user's connection
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Find which OpenBrain user linked this Telegram chat
    const { data: connection } = await supabase
      .from("messaging_connections")
      .select("user_id, brain_id")
      .eq("platform", "telegram")
      .eq("platform_user_id", String(chatId))
      .single();

    if (!connection) {
      await sendMessage(
        chatId,
        "Your Telegram isn't linked to OpenBrain yet.\n\nOpen the app → Settings → Messaging and link your account."
      );
      return new Response("ok", { status: 200 });
    }

    // Fetch per-user AI settings (key + model), fall back to shared env vars
    const { data: aiSettings } = await supabase
      .from("user_ai_settings")
      .select("openrouter_key, openrouter_model, model_chat")
      .eq("user_id", connection.user_id)
      .single();

    const resolvedKey = aiSettings?.openrouter_key || OPENROUTER_API_KEY;
    // Prefer task-specific chat model, then global OR model, then hardcoded default
    const resolvedModel = aiSettings?.model_chat || aiSettings?.openrouter_model || OPENROUTER_MODEL;

    if (!resolvedKey) {
      await sendMessage(chatId, "No OpenRouter API key is configured. Add yours in the app under Settings → AI Provider.");
      return new Response("ok", { status: 200 });
    }

    // Fetch the user's most recent brain entries for context
    const { data: entries } = await supabase
      .from("entries")
      .select("title, content, type, tags")
      .eq("brain_id", connection.brain_id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch user memory (personalised context the app builds up)
    const { data: memoryRow } = await supabase
      .from("user_memory")
      .select("content")
      .eq("user_id", connection.user_id)
      .single();

    // Format entries as a readable list
    const entriesText = (entries ?? [])
      .map((e) => {
        const body = e.content ? `: ${e.content.slice(0, 200)}` : "";
        const tags = e.tags?.length ? ` [${e.tags.join(", ")}]` : "";
        return `• [${e.type}] ${e.title}${body}${tags}`;
      })
      .join("\n");

    const systemPrompt = [
      "You are OpenBrain, a personal AI assistant with access to the user's private knowledge base.",
      "",
      memoryRow?.content ? `USER MEMORY:\n${memoryRow.content}` : "",
      "",
      `BRAIN ENTRIES (${entries?.length ?? 0} items):`,
      entriesText || "No entries yet.",
      "",
      "Answer the user's question truthfully using the brain data above.",
      "If the brain doesn't contain relevant info, say so honestly.",
      "Keep replies concise and direct. No markdown — plain text only (Telegram formatting).",
    ]
      .filter((l) => l !== undefined)
      .join("\n")
      .trim();

    // Call OpenRouter
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedKey}`,
        "HTTP-Referer": SUPABASE_URL ?? "https://openbrain.app",
        "X-Title": "OpenBrain Telegram Bot",
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 800,
      }),
    });

    const aiData = await aiRes.json();
    const reply: string =
      aiData.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn't get a response right now. Try again in a moment.";

    await sendMessage(chatId, reply);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return new Response("error", { status: 500 });
  }
});
