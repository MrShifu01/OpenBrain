import { useCallback, useEffect, useState } from "react";
import type { CustomerInfo } from "@revenuecat/purchases-capacitor";
import {
  addCustomerInfoListener,
  getCustomerInfo,
  hasProEntitlement,
  isNative,
  presentCustomerCenter,
  presentPaywall,
  restorePurchases,
} from "../lib/revenuecat";

interface State {
  /** Initialized to null — distinguishes "not loaded" from "loaded, no entitlement". */
  customerInfo: CustomerInfo | null;
  /** Locally-cached "is pro" — flips immediately after a successful purchase
   *  via the listener, without waiting for the Supabase round-trip. */
  isPro: boolean;
  isLoading: boolean;
  /** True only on iOS / Android. Web should use the existing Lemon flow. */
  isNativePlatform: boolean;
}

/**
 * Subscribes to RevenueCat CustomerInfo updates and exposes
 * paywall / restore / customer-center actions.
 *
 * Use this for *immediate* unlock UX: when the user completes a purchase
 * the listener fires, isPro flips true, and gated UI re-renders without
 * waiting for the webhook → Supabase → useSubscription() roundtrip.
 *
 * For canonical tier checks (cross-device, server-validated), keep using
 * useSubscription(). This hook is the optimistic layer in front of it.
 */
export function useRevenueCatEntitlement() {
  const [state, setState] = useState<State>({
    customerInfo: null,
    isPro: false,
    isLoading: isNative(),
    isNativePlatform: isNative(),
  });

  useEffect(() => {
    // Initial state already has isLoading=false on web (see useState init);
    // no fetch needed — RC never runs on web. Bail before subscribing.
    if (!isNative()) return;

    let detach: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      // Initial fetch from local cache.
      const info = await getCustomerInfo();
      if (cancelled) return;
      setState({
        customerInfo: info,
        isPro: hasProEntitlement(info),
        isLoading: false,
        isNativePlatform: true,
      });

      // Subscribe to updates — fires on purchase, restore, refresh.
      detach = await addCustomerInfoListener((next) => {
        setState((prev) => ({
          ...prev,
          customerInfo: next,
          isPro: hasProEntitlement(next),
        }));
      });
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, []);

  const openPaywall = useCallback(async () => {
    return presentPaywall();
  }, []);

  const openCustomerCenter = useCallback(async () => {
    await presentCustomerCenter();
  }, []);

  const restore = useCallback(async () => {
    const { ok, info } = await restorePurchases();
    if (info) {
      setState((prev) => ({ ...prev, customerInfo: info, isPro: hasProEntitlement(info) }));
    }
    return ok;
  }, []);

  return {
    ...state,
    openPaywall,
    openCustomerCenter,
    restore,
  };
}
