import { callAI } from "./ai";
import { PROMPTS } from "../config/prompts";

/* ─── AI Connection Discovery ─── */
export async function findConnections(newEntry, existingEntries, existingLinks) {
  const candidates = existingEntries
    .filter(e => e.id !== newEntry.id)
    .slice(0, 50)
    .map(e => ({ id: e.id, title: e.title, type: e.type, tags: e.tags, content: (e.content || "").slice(0, 120) }));
  if (candidates.length === 0) return [];
  const existingKeys = new Set(existingLinks.map(l => `${l.from}-${l.to}`));
  try {
    const res = await callAI({
      max_tokens: 600,
      system: PROMPTS.CONNECTION_FINDER,
      messages: [{ role: "user", content: `NEW ENTRY:\n${JSON.stringify({ id: newEntry.id, title: newEntry.title, type: newEntry.type, content: newEntry.content, tags: newEntry.tags })}\n\nEXISTING ENTRIES:\n${JSON.stringify(candidates)}` }]
    });
    const data = await res.json();
    const raw = (data.content?.[0]?.text || "[]").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(l =>
      l.from && l.to && l.rel &&
      candidates.some(c => c.id === l.to) &&
      !existingKeys.has(`${l.from}-${l.to}`) &&
      !existingKeys.has(`${l.to}-${l.from}`)
    );
  } catch { return []; }
}

/* ─── Duplicate Score ─── */
export function scoreTitle(a, b) {
  a = a.toLowerCase().trim(); b = b.toLowerCase().trim();
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 70;
  const aSet = new Set(a.split(/\W+/).filter(Boolean));
  const bArr = b.split(/\W+/).filter(Boolean);
  const hits = bArr.filter(w => aSet.has(w)).length;
  return Math.round((hits / Math.max(aSet.size, bArr.length, 1)) * 100);
}
