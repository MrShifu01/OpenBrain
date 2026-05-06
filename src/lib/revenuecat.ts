/**
 * RevenueCat (mobile) wrapper.
 *
 * Web flow uses LemonSqueezy (see settings/BillingTab.tsx). Native flow
 * (iOS / Android via Capacitor) goes through RevenueCat: paywall, purchase,
 * restore, customer center. The RevenueCat backend then fires a webhook
 * at /api/revenuecat-webhook (api/user-data.ts) which updates
 * user_profiles.tier — that's the canonical source of truth read by
 * useSubscription() across web + native.
 *
 * Why two providers: Apple/Google require their own IAP for digital goods,
 * RevenueCat sits in front of StoreKit/Play Billing. Web has no such
 * requirement and LemonSqueezy is cheaper + already wired up.
 *
 * IMPORTANT: every export here is a no-op on web. Calling Purchases.* on
 * a non-native platform throws — wrap every entry point in `isNative()`.
 */

import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
// Cast PurchasesPackage to the UI library's bundled type — purchases-capacitor-ui
// pins its own copy of purchases-typescript-internal-esm with newer fields.
// At runtime they're identical objects from the same native bridge.
import { RevenueCatUI, PAYWALL_RESULT } from "@revenuecat/purchases-capacitor-ui";

// Set the entitlement identifier here once. Must match the entitlement
// configured in the RevenueCat dashboard (Project → Entitlements). The
// label "Everion Mind Pro" is a display name; the identifier is what the
// SDK checks against. Update if it differs in the dashboard.
export const ENTITLEMENT_ID = "everion_mind_pro";

// Per-platform API keys. Keep as Vite env vars so they bake into the
// native bundle at build time. Web reads neither — the SDK never
// initializes on web.
const IOS_KEY = (import.meta.env.VITE_REVENUECAT_API_KEY_IOS as string | undefined) ?? "";
const ANDROID_KEY = (import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID as string | undefined) ?? "";

let configured = false;

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function pickApiKey(): string | null {
  if (!isNative()) return null;
  const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"
  if (platform === "ios") return IOS_KEY || null;
  if (platform === "android") return ANDROID_KEY || null;
  return null;
}

/**
 * Initialize the SDK. Call once at app boot, BEFORE any purchase / paywall
 * call. Idempotent — safe to call from multiple mount points (the underlying
 * SDK rejects double-configure but we gate in JS too).
 */
export async function configureRevenueCat(): Promise<void> {
  if (!isNative() || configured) return;
  const apiKey = pickApiKey();
  if (!apiKey) {
    console.warn(
      "[revenuecat] No API key for platform — skipping init. Set VITE_REVENUECAT_API_KEY_IOS / _ANDROID.",
    );
    return;
  }
  try {
    await Purchases.configure({ apiKey });
    if (import.meta.env.DEV) {
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    }
    configured = true;
  } catch (err) {
    console.error("[revenuecat] configure failed", err);
  }
}

/**
 * Link the SDK to your Supabase user.id. Call right after a successful
 * Supabase sign-in / session restore. The webhook handler resolves
 * appUserID → user_profiles row, so this MUST be the Supabase user.id —
 * no hashing, no email, no random.
 *
 * On logout, call resetRevenueCatUser().
 */
export async function loginRevenueCatUser(supabaseUserId: string): Promise<void> {
  if (!isNative() || !configured) return;
  try {
    await Purchases.logIn({ appUserID: supabaseUserId });
  } catch (err) {
    console.error("[revenuecat] logIn failed", err);
  }
}

export async function resetRevenueCatUser(): Promise<void> {
  if (!isNative() || !configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.error("[revenuecat] logOut failed", err);
  }
}

/**
 * Read CustomerInfo synchronously from the SDK's local cache (RC keeps
 * this fresh in the background and pushes updates via the listener
 * registered in useRevenueCatEntitlement).
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isNative() || !configured) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (err) {
    console.error("[revenuecat] getCustomerInfo failed", err);
    return null;
  }
}

/**
 * True if the user currently has the Everion Mind Pro entitlement active.
 * Use this for optimistic unlock immediately after purchase — the
 * canonical tier still comes from Supabase user_profiles via the
 * webhook, but the webhook can land 1-3 seconds after the purchase
 * completes and the user expects the paywall to disappear instantly.
 */
export function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

/**
 * Fetch all configured offerings. The "current" offering is the one
 * marked default in the RevenueCat dashboard — that's the one the
 * paywall presents by default.
 */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!isNative() || !configured) return null;
  try {
    const { current } = await Purchases.getOfferings();
    return current ?? null;
  } catch (err) {
    console.error("[revenuecat] getOfferings failed", err);
    return null;
  }
}

/**
 * Programmatic purchase — only used if you build a custom paywall UI.
 * For the standard flow, prefer presentPaywall() which handles the
 * package picker, error states, and restore in one component.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ ok: boolean; cancelled: boolean; info: CustomerInfo | null; error?: string }> {
  if (!isNative() || !configured) {
    return {
      ok: false,
      cancelled: false,
      info: null,
      error: "RevenueCat unavailable on this platform",
    };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return { ok: hasProEntitlement(customerInfo), cancelled: false, info: customerInfo };
  } catch (err) {
    const e = err as { userCancelled?: boolean; message?: string };
    if (e.userCancelled) {
      return { ok: false, cancelled: true, info: null };
    }
    return {
      ok: false,
      cancelled: false,
      info: null,
      error: e.message ?? "Purchase failed",
    };
  }
}

/**
 * Restore previously purchased entitlements. Required by App Store review
 * — every paywall MUST expose a "Restore Purchases" button. The native
 * paywall presented via presentPaywall() includes this automatically.
 */
export async function restorePurchases(): Promise<{ ok: boolean; info: CustomerInfo | null }> {
  if (!isNative() || !configured) return { ok: false, info: null };
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return { ok: hasProEntitlement(customerInfo), info: customerInfo };
  } catch (err) {
    console.error("[revenuecat] restorePurchases failed", err);
    return { ok: false, info: null };
  }
}

/**
 * Present the RevenueCat-hosted paywall. Resolves with one of
 * PAYWALL_RESULT.{PURCHASED, RESTORED, CANCELLED, NOT_PRESENTED, ERROR}.
 * Configure the paywall content + default offering in the dashboard
 * (Paywalls → Editor; Offerings → Default). To A/B-test offerings, change
 * the dashboard default — that keeps offering selection out of the
 * client.
 */
export async function presentPaywall(): Promise<PAYWALL_RESULT> {
  if (!isNative() || !configured) return PAYWALL_RESULT.NOT_PRESENTED;
  try {
    const { result } = await RevenueCatUI.presentPaywall();
    return result;
  } catch (err) {
    console.error("[revenuecat] presentPaywall failed", err);
    return PAYWALL_RESULT.ERROR;
  }
}

/**
 * Present the RevenueCat customer center — manage subscription, cancel,
 * troubleshoot, contact support. Wire to a "Manage Subscription" button
 * in the BillingTab when the active provider is RevenueCat.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!isNative() || !configured) return;
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (err) {
    console.error("[revenuecat] presentCustomerCenter failed", err);
  }
}

/**
 * Subscribe to CustomerInfo changes. Fires whenever the SDK gets a new
 * info payload (purchase, restore, periodic refresh, foreground sync).
 * Returns an unsubscribe function. Use this in useRevenueCatEntitlement.
 */
export async function addCustomerInfoListener(
  cb: (info: CustomerInfo) => void,
): Promise<() => void> {
  if (!isNative() || !configured) return () => {};
  try {
    const handle = await Purchases.addCustomerInfoUpdateListener(cb);
    return () => {
      // SDK exposes removeCustomerInfoUpdateListener on the platform side;
      // the JS handle is opaque so we wrap it as a no-op closure that
      // detaches via the SDK's own removal API if available, otherwise
      // relies on app teardown.
      try {
        // @ts-expect-error — runtime handle, types vary across SDK versions
        Purchases.removeCustomerInfoUpdateListener?.(handle);
      } catch {
        /* no-op */
      }
    };
  } catch (err) {
    console.error("[revenuecat] addCustomerInfoUpdateListener failed", err);
    return () => {};
  }
}
