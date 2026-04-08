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

export function modelLabel(m: ORModel): string {
  const cost = formatCost(m.pricing);
  return cost ? `${m.name} — ${cost}` : m.name;
}
