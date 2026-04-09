/**
 * S5-2: Tag input utilities — autocomplete suggestions + normalization.
 */

/**
 * Returns up to 8 tag suggestions matching the given partial input string,
 * excluding already-selected tags.
 */
export function suggestTags(partial: string, allTags: string[], selected: string[] = []): string[] {
  if (!partial.trim()) return [];
  const lower = partial.toLowerCase();
  const excludeSet = new Set(selected.map((t) => t.toLowerCase()));
  return allTags
    .filter((t) => t.toLowerCase().includes(lower) && !excludeSet.has(t.toLowerCase()))
    .slice(0, 8);
}

/**
 * Parses a comma-separated tag string into a deduplicated lowercase array.
 */
export function normalizeTags(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input.split(",")) {
    const t = raw.trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result;
}
