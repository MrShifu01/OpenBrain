import type { Entry } from "../types";
import { searchIndex } from "./searchIndex";
import { scoreEntriesForQuery } from "./chatContext";

export interface ScoredEntry extends Entry {
  similarity?: number;
  score?: number;
}

export interface SearchStrategy {
  search(query: string, entries: Entry[], brainId?: string): Promise<ScoredEntry[]>;
}

// Unified search dispatcher — returns empty immediately for blank queries
export async function search(
  query: string,
  entries: Entry[],
  strategy: SearchStrategy,
  brainId?: string,
): Promise<ScoredEntry[]> {
  if (!query || !query.trim()) return [];
  return strategy.search(query, entries, brainId);
}

// Token/inverted-index strategy — O(k) lookup via pre-built index
export const tokenSearchStrategy: SearchStrategy = {
  async search(query, entries) {
    if (!query.trim()) return [];
    const ids = searchIndex(query);
    if (!ids) return [];
    return entries.filter((e) => ids.has(e.id));
  },
};

// Keyword scoring strategy — scores entries by word overlap
export const keywordSearchStrategy: SearchStrategy = {
  async search(query, entries) {
    return scoreEntriesForQuery(entries, query) as ScoredEntry[];
  },
};
