/**
 * S5-6: Search history stored in sessionStorage.
 */

const KEY = "openbrain_search_history";
const MAX = 20;

export function getSearchHistory(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(query: string): void {
  const q = query.trim();
  if (!q) return;
  const prev = getSearchHistory().filter((h) => h !== q);
  const next = [q, ...prev].slice(0, MAX);
  sessionStorage.setItem(KEY, JSON.stringify(next));
}

export function clearSearchHistory(): void {
  sessionStorage.removeItem(KEY);
}
