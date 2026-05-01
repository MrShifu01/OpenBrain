import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { trackTierChange } from "./events";

const TIER_SEEN_KEY = "everion_tier_seen";

type Tier = "free" | "starter" | "pro" | "max";
type UsageAction = "captures" | "chats" | "voice" | "improve";

interface UsageCounts {
  captures: number;
  chats: number;
  voice: number;
  improve: number;
}

const LIMITS: Record<Tier, UsageCounts> = {
  free: { captures: 0, chats: 0, voice: 0, improve: 0 },
  starter: { captures: 500, chats: 200, voice: 20, improve: 20 },
  pro: { captures: 2000, chats: 1000, voice: 100, improve: 9999 },
  max: { captures: 9999, chats: 9999, voice: 9999, improve: 9999 },
};

const ZERO_USAGE: UsageCounts = { captures: 0, chats: 0, voice: 0, improve: 0 };

type Provider = "lemonsqueezy" | "revenuecat" | "stripe" | null;

interface SubscriptionState {
  tier: Tier;
  usage: UsageCounts;
  limits: UsageCounts;
  pct: Partial<Record<UsageAction, number>>;
  renewalDate: string | null;
  /** Where the active subscription was paid — drives BillingTab branching. */
  provider: Provider;
  isLoading: boolean;
}

export function useSubscription(): SubscriptionState {
  const [tier, setTier] = useState<Tier>("free");
  const [usage, setUsage] = useState<UsageCounts>(ZERO_USAGE);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const period = new Date().toISOString().slice(0, 7);

      const [profileRes, usageRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("tier,current_period_end,tier_expires_at,billing_provider")
          .eq("id", user.id)
          .single(),
        supabase
          .from("user_usage")
          .select("captures,chats,voice,improve")
          .eq("user_id", user.id)
          .eq("period", period)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const rawTier = (profileRes.data?.tier ?? "free") as Tier;
      // Prefer current_period_end (set by 064-style billing). Fall back to
      // tier_expires_at for any pre-migration row left over from Stripe.
      const renewsAt =
        profileRes.data?.current_period_end ?? profileRes.data?.tier_expires_at ?? null;
      // tier_expires_at is the legacy "downgrade after this point" column —
      // honour it if set, otherwise trust the tier as-is.
      const expiresAt = profileRes.data?.tier_expires_at ?? null;
      const effectiveTier: Tier = expiresAt && new Date(expiresAt) < new Date() ? "free" : rawTier;

      // Funnel — diff the tier we last saw on this device against the one
      // we just loaded. trackTierChange handles direction (up vs down) and
      // is a no-op when prev/next match. No localStorage value on first
      // load → skip the diff (we don't fire on initial signup).
      try {
        const prevTier = localStorage.getItem(TIER_SEEN_KEY) ?? undefined;
        if (prevTier) trackTierChange(prevTier, effectiveTier);
        localStorage.setItem(TIER_SEEN_KEY, effectiveTier);
      } catch {
        /* private mode — silently skip funnel tracking, the DB is source of truth */
      }

      setTier(effectiveTier);
      setRenewalDate(renewsAt);
      setProvider((profileRes.data?.billing_provider as Provider) ?? null);
      setUsage(usageRes.data ?? ZERO_USAGE);
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const limits = LIMITS[tier];

  const pct: Partial<Record<UsageAction, number>> = {};
  for (const action of ["captures", "chats", "voice", "improve"] as UsageAction[]) {
    const limit = limits[action];
    if (limit > 0 && limit < 9999) {
      pct[action] = Math.min(100, Math.round((usage[action] / limit) * 100));
    }
  }

  return { tier, usage, limits, pct, renewalDate, provider, isLoading };
}
