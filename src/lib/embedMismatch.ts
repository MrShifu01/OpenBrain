/**
 * S3-3: Utilities for detecting embedding provider mismatches.
 */

export interface EmbeddableEntry {
  id: string;
  embedding_provider?: string | null;
}

/**
 * Returns the number of entries that have embeddings from a different provider
 * than the one currently selected. Unembedded entries are not counted.
 */
export function countEmbedMismatches(entries: EmbeddableEntry[], newProvider: string): number {
  return entries.filter((e) => e.embedding_provider && e.embedding_provider !== newProvider).length;
}
