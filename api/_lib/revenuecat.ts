/**
 * RevenueCat REST client + webhook authentication.
 *
 * Two responsibilities, mirroring the LemonSqueezy module:
 *   1. grantEntitlement / revokeEntitlement — when a web purchase happens at
 *      LemonSqueezy, we bridge to RevenueCat by granting the matching
 *      promotional entitlement against `app_user_id` (which we set to our
 *      user_profiles.id). This way the mobile RC SDK already knows the user
 *      is paid up the moment they install the native app.
 *
 *   2. verifyWebhookAuth — RevenueCat sends an Authorization header with
 *      the shared secret you configure in their dashboard. Constant-time
 *      compare so the secret can't be timed out.
 *
 * Why promotional entitlements (vs purchase grants): you can grant arbitrary
 * durations server-side without an actual store receipt. Perfect for a web
 * purchase that the App Store / Play know nothing about.
 */
import crypto from "crypto";

const API = "https://api.revenuecat.com/v1";

function secretApiKey(): string {
  const k = process.env.REVENUECAT_SECRET_API_KEY;
  if (!k) throw new Error("REVENUECAT_SECRET_API_KEY not set");
  return k;
}

export type EntitlementDuration =
  | "daily"
  | "three_day"
  | "weekly"
  | "monthly"
  | "two_month"
  | "three_month"
  | "six_month"
  | "yearly"
  | "lifetime";

interface GrantInput {
  /** Maps to user_profiles.id — we set RC's app_user_id to the same value. */
  appUserId: string;
  /** RC entitlement identifier (configured in dashboard, e.g. "starter" / "pro"). */
  entitlementId: string;
  /** Named duration; pick to match the underlying LemonSqueezy interval. */
  duration: EntitlementDuration;
}

/**
 * Grants a promotional entitlement of `duration` length. Idempotent on
 * RevenueCat's side — calling twice extends. Webhook handlers may call this
 * on every subscription_updated event without worrying about double-grants.
 */
export async function grantEntitlement(input: GrantInput): Promise<{ ok: boolean }> {
  const path = `/subscribers/${encodeURIComponent(
    input.appUserId,
  )}/entitlements/${encodeURIComponent(input.entitlementId)}/promotional`;
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ duration: input.duration }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => String(r.status));
    console.error(`[revenuecat] grant failed: ${r.status} ${text}`);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Revokes ALL promotional entitlements of `entitlementId` for the user.
 * Used when the LemonSqueezy webhook reports a cancellation / failure.
 */
export async function revokePromotionalEntitlements(
  appUserId: string,
  entitlementId: string,
): Promise<{ ok: boolean }> {
  const path = `/subscribers/${encodeURIComponent(
    appUserId,
  )}/entitlements/${encodeURIComponent(entitlementId)}/revoke_promotionals`;
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretApiKey()}` },
  });
  if (!r.ok) {
    const text = await r.text().catch(() => String(r.status));
    console.error(`[revenuecat] revoke failed: ${r.status} ${text}`);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * RevenueCat sends `Authorization: Bearer <secret>` (configured per-app in
 * their dashboard). Constant-time compare against REVENUECAT_WEBHOOK_AUTH.
 */
export function verifyWebhookAuth(authHeader: string | undefined): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── RevenueCat webhook event payload (subset we use) ──────────────────────────
// Full schema: https://docs.revenuecat.com/docs/webhooks
export interface RevenueCatEvent {
  type:
    | "INITIAL_PURCHASE"
    | "RENEWAL"
    | "PRODUCT_CHANGE"
    | "CANCELLATION"
    | "EXPIRATION"
    | "BILLING_ISSUE"
    | "UNCANCELLATION"
    | "SUBSCRIBER_ALIAS"
    | "TRANSFER"
    | "NON_RENEWING_PURCHASE"
    | "TEST";
  app_user_id: string;
  product_id?: string;
  /** "APP_STORE" | "PLAY_STORE" | "STRIPE" | "PROMOTIONAL" | "MAC_APP_STORE" | "AMAZON" */
  store?: string;
  original_transaction_id?: string;
  transaction_id?: string;
  /** Play-only — purchase token. */
  purchase_token?: string;
  /** Epoch ms. */
  expiration_at_ms?: number;
  /** Epoch ms. */
  event_timestamp_ms?: number;
  /** Stable id for de-dup. */
  id?: string;
}

export interface RevenueCatWebhookBody {
  event: RevenueCatEvent;
}
