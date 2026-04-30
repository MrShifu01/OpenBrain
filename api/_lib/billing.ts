/**
 * Provider-agnostic billing layer.
 *
 * Webhook handlers (lemon-webhook, revenuecat-webhook) funnel through this
 * file so the rest of the app sees one canonical tier write regardless of
 * who paid where. The web checkout goes through LemonSqueezy directly; the
 * mobile flow goes through RevenueCat, which itself wraps App Store + Play.
 *
 * Tiers (machine names — match user_profiles.tier check constraint):
 *   "free" | "starter" | "pro"
 *
 * Storage: public.user_profiles (PK = id = auth.users.id). NEVER user_personas
 * — that's the chat-persona record. See migration 065 for the relocation that
 * fixed 064's misplacement.
 */
import { sbHeaders } from "./sbHeaders.js";

const SB_URL = process.env.SUPABASE_URL!;

export type Tier = "free" | "starter" | "pro";
export type Provider = "lemonsqueezy" | "revenuecat" | "stripe";

interface PlanCatalog {
  /** LemonSqueezy variant ids (read from env so prod/test switch cleanly). */
  lemon: { starter: string | null; pro: string | null };
  /** RevenueCat product ids — what the mobile SDK reports for the active sub. */
  revenuecat: { starter: string | null; pro: string | null };
}

/** Read-time so missing env vars don't throw at module-load. */
export function readPlanCatalog(): PlanCatalog {
  return {
    lemon: {
      starter: process.env.LEMONSQUEEZY_STARTER_VARIANT_ID ?? null,
      pro: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null,
    },
    revenuecat: {
      // RC product ids are the App Store / Play product ids you registered
      // in the RevenueCat dashboard. We accept either marketplace's id since
      // the same string represents the same offering on both platforms when
      // configured that way.
      starter: process.env.REVENUECAT_STARTER_PRODUCT_ID ?? "everionmind.starter.monthly",
      pro: process.env.REVENUECAT_PRO_PRODUCT_ID ?? "everionmind.pro.monthly",
    },
  };
}

export function resolveTier(provider: Provider, productId: string): Tier {
  const catalog = readPlanCatalog();
  if (provider === "lemonsqueezy") {
    if (productId === catalog.lemon.pro) return "pro";
    if (productId === catalog.lemon.starter) return "starter";
  } else if (provider === "revenuecat") {
    if (productId === catalog.revenuecat.pro) return "pro";
    if (productId === catalog.revenuecat.starter) return "starter";
  }
  // Unknown SKU is safer treated as free than as the highest tier; webhook
  // logs surface the productId so the operator can add it to the catalog.
  return "free";
}

interface PlanWriteInput {
  userId: string;
  provider: Provider;
  tier: Tier;
  /** LemonSqueezy customer id (web). */
  lemonCustomerId?: string | null;
  /** LemonSqueezy subscription id (web). */
  lemonSubscriptionId?: string | null;
  /** Apple original transaction id (audit trail; sourced from RC webhook). */
  appleOriginalTransactionId?: string | null;
  /** Play purchase token (audit trail; sourced from RC webhook). */
  playPurchaseToken?: string | null;
  /** Play product id (audit trail). */
  playProductId?: string | null;
  /** ISO timestamp of next renewal / lapse date. */
  currentPeriodEnd?: string | null;
}

/**
 * Idempotent upsert of a plan change into user_profiles. Always writes the
 * tier + provider + period_end columns; only writes provider-id columns when
 * the corresponding input is non-undefined so a partial update from one
 * webhook doesn't clobber other providers' ids on the same row.
 */
export async function writePlanChange(input: PlanWriteInput): Promise<{ ok: boolean }> {
  const body: Record<string, unknown> = {
    tier: input.tier,
    billing_provider: input.tier === "free" ? null : input.provider,
    current_period_end: input.currentPeriodEnd ?? null,
  };
  if (input.lemonCustomerId !== undefined) body.lemonsqueezy_customer_id = input.lemonCustomerId;
  if (input.lemonSubscriptionId !== undefined) {
    body.lemonsqueezy_subscription_id = input.lemonSubscriptionId;
  }
  if (input.appleOriginalTransactionId !== undefined) {
    body.appstore_original_transaction_id = input.appleOriginalTransactionId;
  }
  if (input.playPurchaseToken !== undefined) body.playstore_purchase_token = input.playPurchaseToken;
  if (input.playProductId !== undefined) body.playstore_product_id = input.playProductId;
  // Mirror tier_expires_at for the legacy column the existing useSubscription
  // hook still reads — keeps the UI live without a second migration. New code
  // should read current_period_end.
  if (input.tier === "free") {
    body.tier_expires_at = input.currentPeriodEnd ?? null;
  } else {
    body.tier_expires_at = null;
  }

  const r = await fetch(
    `${SB_URL}/rest/v1/user_profiles?id=eq.${encodeURIComponent(input.userId)}`,
    {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) {
    console.error(`[billing] plan write failed for ${input.userId}: ${r.status}`, await r.text());
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Webhook handlers don't always know the userId — only the provider's id of
 * the row that changed. Resolves the user_profiles row by the relevant
 * provider id column.
 */
export async function findUserByProviderId(
  field: "lemon_customer" | "lemon_subscription" | "apple_otx" | "play_token",
  value: string,
): Promise<string | null> {
  const column =
    field === "lemon_customer"
      ? "lemonsqueezy_customer_id"
      : field === "lemon_subscription"
        ? "lemonsqueezy_subscription_id"
        : field === "apple_otx"
          ? "appstore_original_transaction_id"
          : field === "play_token"
            ? "playstore_purchase_token"
            : null;
  if (!column) return null;
  const r = await fetch(
    `${SB_URL}/rest/v1/user_profiles?${column}=eq.${encodeURIComponent(value)}&select=id&limit=1`,
    { headers: sbHeaders() },
  );
  if (!r.ok) return null;
  const rows: Array<{ id: string }> = await r.json();
  return rows[0]?.id ?? null;
}
