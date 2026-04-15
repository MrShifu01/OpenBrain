import type { ApiRequest, ApiResponse } from "./_lib/types";
import { verifyAuth } from "./_lib/verifyAuth.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_HEADERS: Record<string, string> = { apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}` };
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").trim();

const SUGGESTIONS_PROMPT = `You are a second brain assistant. Given a list of entries a user has already captured, generate exactly 3 questions whose answers would most enrich what's already there.

Rules:
- Study WHAT IS THERE: the themes, types, and topics already captured
- Generate questions that deepen or complement the existing content specifically
- If they have suppliers but no pricing context, ask about pricing. If they have recipes but no sourcing, ask about sourcing.
- Questions should be specific and directly answerable — not vague
- Each question should target a different knowledge domain visible in the entries
- Never generate generic questions — every question must be grounded in the actual content
- cat is a short label (1-3 words) for the domain of the question
- Return ONLY valid JSON, no markdown: {"suggestions":[{"q":"...","cat":"..."},{"q":"...","cat":"..."},{"q":"...","cat":"..."}]}
- If data is too sparse, still return 3 generic-but-useful second brain questions`;

const WOW_PROMPT = `You are a personal insight synthesizer for a second-brain app.

Given the user's recent AI-generated insights AND their top brain concepts and relationships, find 1-3 genuine "wow" moments — surprising cross-domain connections, unexpected patterns, or profound implications the user has NOT consciously noticed.

Rules:
- Be specific to THIS user's actual data, never generic advice
- Name the real connection — e.g. "Your supplier notes and pricing research both circle the same margin pressure"
- Headline: under 10 words, punchy, specific
- Detail: 1-2 sentences, direct and insightful
- Skip anything obvious or motivational-poster-level generic
- Return ONLY valid JSON, no markdown: {"wows":[{"headline":"...","detail":"..."}]}
- If data is too sparse for genuine wow moments, return {"wows":[]}`;

function getGreeting(name?: string): string {
  const h = new Date().getHours();
  const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${time}, ${name}.` : `${time}.`;
}

async function generateSuggestions(
  entries: any[],
  topConcepts: string[],
): Promise<Array<{ q: string; cat: string }>> {
  if (!GEMINI_API_KEY || entries.length === 0) return [];

  const entryLines = entries
    .map((e) => `- [${e.type}] ${e.title}${e.tags?.length ? ` (${e.tags.join(", ")})` : ""}`)
    .join("\n");
  const conceptLine = topConcepts.length ? `\n\nTop concepts: ${topConcepts.join(", ")}` : "";

  const userText = `My brain entries:\n${entryLines}${conceptLine}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userText }] }],
          systemInstruction: { parts: [{ text: SUGGESTIONS_PROMPT }] },
          generationConfig: { maxOutputTokens: 512 },
        }),
      },
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const text: string = (data.candidates?.[0]?.content?.parts || [])
      .filter((p: any) => !p.thought)
      .map((p: any) => p.text || "")
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.suggestions)) return [];
    return parsed.suggestions
      .filter((s: any) => s.q && s.cat)
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function synthesizeWows(
  insights: any[],
  topConcepts: string[],
  relationships: string[],
): Promise<Array<{ headline: string; detail: string }>> {
  if (!GEMINI_API_KEY || insights.length < 2) return [];

  const insightLines = insights
    .map((e) => `- ${e.title}: ${String(e.content || "").slice(0, 200)}`)
    .join("\n");

  const conceptLine = topConcepts.length ? `Top concepts: ${topConcepts.join(", ")}` : "";
  const relLine = relationships.length ? `Relationships: ${relationships.join("; ")}` : "";

  const userText = `Recent insights:\n${insightLines}${conceptLine ? `\n\n${conceptLine}` : ""}${relLine ? `\n${relLine}` : ""}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userText }] }],
          systemInstruction: { parts: [{ text: WOW_PROMPT }] },
          generationConfig: { maxOutputTokens: 512 },
        }),
      },
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const text: string = (data.candidates?.[0]?.content?.parts || [])
      .filter((p: any) => !p.thought)
      .map((p: any) => p.text || "")
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.wows)) return [];
    return parsed.wows
      .filter((w: any) => w.headline && w.detail)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applySecurityHeaders(res);
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });

  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const brainId = (req.query.brain_id as string) || "";
  if (!brainId) return res.status(400).json({ error: "brain_id required" });

  try {
    // Run independent fetches in parallel
    const [resurfacedRes, statsRes, userRes, insightRes, sparseRes, graphRes] = await Promise.all([
      // 1. Resurfaced entries: random entries from 1-6 months ago
      fetch(
        `${SB_URL}/rest/v1/entries?brain_id=eq.${brainId}&created_at=gte.${new Date(Date.now() - 180 * 86400000).toISOString()}&created_at=lte.${new Date(Date.now() - 30 * 86400000).toISOString()}&deleted_at=is.null&select=id,title,content,type,tags,created_at&order=random&limit=2`,
        { headers: SB_HEADERS },
      ),
      // 2. Stats: entry count
      fetch(
        `${SB_URL}/rest/v1/entries?brain_id=eq.${brainId}&deleted_at=is.null&select=id`,
        { headers: { ...SB_HEADERS, Prefer: "count=exact" } },
      ),
      // 3. User metadata (streak)
      fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, { headers: SB_HEADERS }),
      // 4. Recent entries that have an ai_insight in metadata (last 10)
      fetch(
        `${SB_URL}/rest/v1/entries?brain_id=eq.${brainId}&metadata->>ai_insight=not.is.null&deleted_at=is.null&select=id,title,metadata&order=created_at.desc&limit=10`,
        { headers: SB_HEADERS },
      ),
      // 5. Recent entries for suggestions context (last 20)
      fetch(
        `${SB_URL}/rest/v1/entries?brain_id=eq.${brainId}&deleted_at=is.null&select=id,title,type,tags&order=created_at.desc&limit=20`,
        { headers: SB_HEADERS },
      ),
      // 6. Concept graph
      fetch(
        `${SB_URL}/rest/v1/concept_graphs?brain_id=eq.${encodeURIComponent(brainId)}&select=graph`,
        { headers: SB_HEADERS },
      ),
    ]);

    const resurfaced = resurfacedRes.ok ? await resurfacedRes.json() : [];
    const entryCount = parseInt(statsRes.headers.get("content-range")?.split("/")[1] || "0", 10);
    const userData = userRes.ok ? await userRes.json() : {};
    const meta = userData.user_metadata || {};
    const streak = { current: meta.current_streak || 0, longest: meta.longest_streak || 0 };
    const insightRows: any[] = insightRes.ok ? await insightRes.json() : [];
    // Map to {title, content} shape expected by synthesizeWows
    const insights = insightRows.map((e) => ({
      title: e.title,
      content: String(e.metadata?.ai_insight || ""),
    }));
    const recentEntries: any[] = sparseRes.ok ? await sparseRes.json() : [];

    // Extract top concepts + relationships from graph for wow/suggestions synthesis
    let topConcepts: string[] = [];
    let relationships: string[] = [];
    if (graphRes.ok) {
      const graphRows: any[] = await graphRes.json();
      const graph = graphRows[0]?.graph;
      if (graph) {
        topConcepts = (graph.concepts || [])
          .sort((a: any, b: any) => (b.frequency || 0) - (a.frequency || 0))
          .slice(0, 12)
          .map((c: any) => c.label);
        relationships = (graph.relationships || [])
          .slice(0, 15)
          .map((r: any) => `${r.source} → ${r.target}`);
      }
    }

    // Run both LLM calls in parallel
    const [wows, suggestions] = await Promise.all([
      synthesizeWows(insights, topConcepts, relationships),
      generateSuggestions(recentEntries, topConcepts),
    ]);

    const name = meta.full_name || meta.name || user.email?.split("@")[0] || "";

    return res.status(200).json({
      greeting: getGreeting(name),
      resurfaced,
      wows,
      suggestions,
      streak,
      stats: { entries: entryCount, connections: 0, insights: insights.length },
    });
  } catch (err: any) {
    console.error("[feed]", err);
    return res.status(500).json({ error: "Failed to load feed" });
  }
}
