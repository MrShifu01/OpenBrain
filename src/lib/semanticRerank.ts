/**
 * S6-1: Semantic re-ranking.
 * Combines vector similarity with keyword overlap to produce a final score.
 */

export interface RerankEntry {
  id: string;
  title?: string;
  content?: string;
  similarity?: number;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Re-ranks entries by combining semantic similarity with keyword overlap.
 * Returns a new sorted array without mutating the input.
 */
export function rerankEntries(entries: RerankEntry[], query: string): RerankEntry[] {
  if (!entries.length) return [];

  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  return [...entries].sort((a, b) => combinedScore(b, tokens) - combinedScore(a, tokens));
}

function keywordOverlap(entry: RerankEntry, tokens: string[]): number {
  if (!tokens.length) return 0;
  const text = `${entry.title ?? ""} ${entry.content ?? ""}`.toLowerCase();
  const hits = tokens.filter((t) => text.includes(t)).length;
  return hits / tokens.length;
}

function combinedScore(entry: RerankEntry, tokens: string[]): number {
  const sim = entry.similarity ?? 0;
  const kw = keywordOverlap(entry, tokens);
  // 70% similarity + 30% keyword overlap
  return sim * 0.7 + kw * 0.3;
}
