/**
 * LemonSqueezy client + webhook signature verifier.
 *
 * LemonSqueezy is a merchant of record (handles VAT/tax/payment compliance
 * for digital goods worldwide), which is why it replaced Stripe for the web
 * checkout path. Their hosted checkout is a single URL the client navigates
 * to — no client-side SDK needed.
 *
 * Two responsibilities here:
 *   1. createCheckoutUrl() — POST to /v1/checkouts to mint a one-shot URL
 *      that opens the LemonSqueezy hosted checkout for a specific variant.
 *      We embed the user_id + tier in custom_data so the webhook handler
 *      can match the resulting subscription back to the user.
 *
 *   2. verifyWebhookSignature() — HMAC-SHA256 the raw body with the signing
 *      secret and compare against the X-Signature header in constant time.
 */
import { createHmac, timingSafeEqual } from "crypto";

const API = "https://api.lemonsqueezy.com/v1";

function apiKey(): string {
  const k = process.env.LEMONSQUEEZY_API_KEY;
  if (!k) throw new Error("LEMONSQUEEZY_API_KEY not set");
  return k;
}

function storeId(): string {
  const s = process.env.LEMONSQUEEZY_STORE_ID;
  if (!s) throw new Error("LEMONSQUEEZY_STORE_ID not set");
  return s;
}

interface CheckoutInput {
  variantId: string;
  email?: string | null;
  userId: string;
  /** Tier name ("starter" | "pro") — embedded so webhook can resolve without
   *  a second round-trip when the variant id alone is ambiguous. */
  tier: string;
  /** URL to send the user back to after checkout completes. */
  successUrl: string;
}

export async function createCheckoutUrl(input: CheckoutInput): Promise<string> {
  const body = {
    data: {
      type: "checkouts",
      attributes: {
        // Custom data is echoed back on every webhook event for this checkout's
        // resulting subscription. We use it to bridge LemonSqueezy's customer
        // id back to our user_personas.id without requiring an email match.
        checkout_data: {
          email: input.email ?? undefined,
          custom: {
            user_id: input.userId,
            tier: input.tier,
          },
        },
        product_options: {
          // Take the user back to /settings?tab=billing on success so the
          // BillingTab can read its own row and re-render the active state.
          redirect_url: input.successUrl,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: storeId() } },
        variant: { data: { type: "variants", id: input.variantId } },
      },
    },
  };
  const res = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`LemonSqueezy checkout create failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = json.data?.attributes?.url;
  if (!url) throw new Error("LemonSqueezy checkout response missing url");
  return url;
}

/**
 * Customer portal URL — LemonSqueezy hosts this; users manage cancel /
 * payment method / invoice history there. Each customer has a stable URL
 * we look up via the customer id we stored at first checkout.
 */
export async function getCustomerPortalUrl(customerId: string): Promise<string> {
  const res = await fetch(`${API}/customers/${customerId}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/vnd.api+json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`LemonSqueezy customer fetch failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    data?: { attributes?: { urls?: { customer_portal?: string } } };
  };
  const url = json.data?.attributes?.urls?.customer_portal;
  if (!url) throw new Error("LemonSqueezy customer response missing portal url");
  return url;
}

export interface SignatureResult {
  ok: boolean;
  reason?: "missing_secret" | "missing_signature" | "bad_signature";
}

/**
 * Constant-time HMAC-SHA256 of the raw body, compared to X-Signature header.
 * Caller must pass the *raw* request body buffer — JSON.parse(body) and
 * re-stringify will produce a different hash.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): SignatureResult {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signatureHeader, "hex");
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  if (provided.length !== expected.length) return { ok: false, reason: "bad_signature" };
  return timingSafeEqual(provided, expected) ? { ok: true } : { ok: false, reason: "bad_signature" };
}
