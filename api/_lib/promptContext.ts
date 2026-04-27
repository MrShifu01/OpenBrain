// Shared prompt-context helpers used at every server-side LLM entry point
// (api/_lib/aiProvider.ts callAI + api/_lib/providers/chatRunner.ts runChat).
//
// Why a separate module: runtime-derived context (today's date, in future
// also locale, time zone, persona-derived aliases) belongs once, applied
// everywhere. Inlining at each call site would drift the moment one path
// gets a new piece of context.

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Prepend today's date as a [Context] block to the given system prompt.
 * The model has no internal clock — without this, "this Friday", "next
 * Monday", "tomorrow" become guesswork. The "this Friday → weekly
 * recurring" calendar bug had this as one root cause.
 */
export function withDateContext(system: string): string {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `[Context]\nToday is ${iso} (${DAY_NAMES[d.getDay()]}). Use this when resolving relative dates like "today", "tomorrow", "this Friday", "next month".\n\n${system}`;
}
