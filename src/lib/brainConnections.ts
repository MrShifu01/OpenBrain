import { authFetch } from "./authFetch";
import { callAI } from "./ai";
import { PROMPTS } from "../config/prompts";
import {
  extractConcepts,
  extractRelationships,
  mergeGraph,
  loadGraphFromDB,
  saveGraphToDB,
} from "./conceptGraph";

const CAPTURE_COUNT_KEY = "openbrain_capture_count";

/** Increment the per-brain capture counter. Returns the new count. */
export function incrementCaptureCount(brainId: string): number {
  const key = `${CAPTURE_COUNT_KEY}_${brainId}`;
  const count = parseInt(localStorage.getItem(key) || "0", 10) + 1;
  localStorage.setItem(key, String(count));
  return count;
}

/**
 * Build brain connections (concept + relationship extraction) for a brain.
 * Fire-and-forget safe — all errors are caught internally.
 * Pass an optional onStatus callback for UI feedback; omit for silent background use.
 */
export async function buildBrainConnections(
  brainId: string,
  onStatus?: (s: string) => void,
): Promise<void> {
  const status = onStatus ?? (() => {});
  status("Fetching entries…");
  try {
    const res = await authFetch(
      `/api/entries?brain_id=${encodeURIComponent(brainId)}&limit=100`,
    );
    if (!res.ok) throw new Error("Could not fetch entries");
    const body = await res.json();
    const entries: any[] = Array.isArray(body) ? body : (body.entries ?? []);
    if (entries.length === 0) { status("No entries found."); return; }

    // Keep summary compact — long content causes the AI to exceed max_tokens and truncate the JSON
    const summary = entries
      .slice(0, 80)
      .map((e) =>
        `[${e.id}] (${e.type}) ${e.title}: ${String(e.content || "").replace(/[\r\n]+/g, " ").slice(0, 80)}`,
      )
      .join("\n");

    status(`Analysing ${entries.length} entries with AI…`);
    const aiRes = await callAI({
      task: "refine",
      max_tokens: 4096,
      system: `Today's date is ${new Date().toISOString().slice(0, 10)}. ${PROMPTS.COMBINED_AUDIT}`,
      brainId,
      messages: [{ role: "user", content: `Here are the brain entries:\n\n${summary}` }],
    });
    if (!aiRes.ok) throw new Error(`AI error ${aiRes.status}`);
    const raw = await aiRes.json();
    const text: string = raw?.content?.[0]?.text || raw?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");
    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Attempt to salvage individual arrays from a truncated response
      const conceptsMatch = text.match(/"concepts"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
      const relsMatch = text.match(/"relationships"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
      parsed = {
        concepts: conceptsMatch ? JSON.parse(conceptsMatch[1]) : [],
        relationships: relsMatch ? JSON.parse(relsMatch[1]) : [],
      };
    }

    const newConcepts = parsed.concepts ? extractConcepts(parsed.concepts) : [];
    const newRels = parsed.relationships ? extractRelationships(parsed.relationships) : [];

    status("Saving connections…");
    const existing = await loadGraphFromDB(brainId);
    const merged = mergeGraph(existing, { concepts: newConcepts, relationships: newRels });
    await saveGraphToDB(brainId, merged);
    status(`Done — ${newConcepts.length} concepts, ${newRels.length} relationships saved.`);
  } catch (e: any) {
    status(`Error: ${e.message}`);
  }
}
