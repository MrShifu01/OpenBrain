export type TierId = "free" | "free_byok" | "pro" | "pro_byok";

export interface TierDef {
  id: TierId;
  label: string;
  subtitle: string;
  included: string[];
  missing: string[];
}

export const TIERS: TierDef[] = [
  {
    id: "free",
    label: "Free",
    subtitle: "No AI keys — storage only",
    included: [
      "Manual capture & storage",
      "Basic keyword search",
      "Tags, types & organisation",
      "Offline support",
      "Vault (encrypted secrets)",
    ],
    missing: [
      "AI parsing & classification",
      "Vector embeddings",
      "Semantic search",
      "Concept extraction & graph",
      "AI insights per entry",
      "Gmail scanning",
      "Calendar integration",
    ],
  },
  {
    id: "free_byok",
    label: "Free + Keys",
    subtitle: "Free plan · Your own API keys",
    included: [
      "Full AI enrichment pipeline",
      "AI parsing, classification & metadata extraction",
      "Vector embeddings & semantic search",
      "Concept extraction & knowledge graph",
      "AI insights per entry",
      "Gmail scanning & smart classification",
      "Calendar integration",
    ],
    missing: [
      "Platform-managed quota (pay per key use)",
      "Priority processing",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    subtitle: "Pro plan · Platform API keys",
    included: [
      "Full AI enrichment pipeline",
      "AI parsing, classification & metadata extraction",
      "Vector embeddings & semantic search",
      "Concept extraction & knowledge graph",
      "AI insights per entry",
      "Gmail scanning & smart classification",
      "Calendar integration",
      "Platform-managed quota (no key required)",
      "Priority processing & support",
    ],
    missing: [
      "Custom model selection",
      "Unlimited AI quota (quota applies)",
    ],
  },
  {
    id: "pro_byok",
    label: "Pro + Keys",
    subtitle: "Pro plan · Your own API keys",
    included: [
      "Full AI enrichment pipeline",
      "AI parsing, classification & metadata extraction",
      "Vector embeddings & semantic search",
      "Concept extraction & knowledge graph",
      "AI insights per entry",
      "Gmail scanning & smart classification",
      "Calendar integration",
      "Custom model selection",
      "No platform quota limits",
      "Priority processing & support",
    ],
    missing: [],
  },
];

export const TIER_LABELS: Record<TierId, string> = {
  free: "Free",
  free_byok: "Free + Keys",
  pro: "Pro",
  pro_byok: "Pro + Keys",
};

export function deriveTierId(plan: string, hasAnyKey: boolean): TierId {
  const isPro = plan === "pro";
  if (isPro && hasAnyKey) return "pro_byok";
  if (isPro) return "pro";
  if (hasAnyKey) return "free_byok";
  return "free";
}
