export interface ORModel {
  id: string;
  name: string;
  pricing?: { prompt?: string };
  /** Architecture metadata from OpenRouter API */
  architecture?: { modality?: string };
  /** Top-level modality string (some OR models expose this) */
  modality?: string;
}

/** Price tier thresholds (per input token):
 *  free     = $0
 *  cheap    = $0 < p < $2/1M  (< 2e-6/token)
 *  good     = $2–$15/1M       (2e-6 to 1.5e-5/token)
 *  frontier = >=$15/1M        (>= 1.5e-5/token) or unpriced
 */
export type PriceTier = "free" | "cheap" | "good" | "frontier";
export type FilterTier = "all" | PriceTier;

export function getPriceTier(pricing?: { prompt?: string }): PriceTier {
  const p = parseFloat(pricing?.prompt ?? "");
  if (isNaN(p)) return "frontier";
  if (p === 0) return "free";
  if (p < 2e-6) return "cheap";
  if (p < 1.5e-5) return "good";
  return "frontier";
}

export function formatCost(pricing?: { prompt?: string }): string {
  const p = parseFloat(pricing?.prompt ?? "");
  if (isNaN(p)) return "";
  if (p === 0) return "Free";
  return `$${(p * 1e6).toFixed(2)}/1M`;
}

export function filterByTier(models: ORModel[], tier: FilterTier): ORModel[] {
  if (tier === "all") return models;
  return models.filter(m => getPriceTier(m.pricing) === tier);
}

/** Best model per tier for knowledge capture, RAG chat, refinement, and vision tasks. */
export const TIER_RECOMMENDED: Record<PriceTier, string> = {
  free:     "google/gemini-2.0-flash-lite:free",  // fast, multimodal, already default
  cheap:    "google/gemini-2.0-flash-001",         // ~$0.10/1M, excellent all-rounder
  good:     "anthropic/claude-3.7-sonnet",         // best reasoning + instruction following
  frontier: "anthropic/claude-opus-4",             // max quality for complex RAG & refinement
};

/** Moves the recommended model for the given tier to the front of the list. */
export function sortWithRecommended(models: ORModel[], tier: FilterTier): ORModel[] {
  if (tier === "all") return models;
  const recId = TIER_RECOMMENDED[tier as PriceTier];
  const idx = models.findIndex(m => m.id === recId);
  if (idx <= 0) return models;
  return [models[idx], ...models.slice(0, idx), ...models.slice(idx + 1)];
}

export function modelLabel(m: ORModel, recommendedId?: string): string {
  const cost = formatCost(m.pricing);
  const costStr = cost ? ` — ${cost}` : "";
  const recStr = m.id === recommendedId ? " (Recommended)" : "";
  return `${m.name}${costStr}${recStr}`;
}
