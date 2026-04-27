/**
 * PostHog wrapper — mirrors the Sentry consent gate in main.tsx.
 *
 *   - import is dynamic, so posthog-js stays out of the initial bundle
 *     entirely. Users who decline analytics never download it; tests
 *     (no consent in storageState) never touch it
 *   - init only fires after the user has accepted the analytics consent
 *     banner (same `everion_analytics_consent` key Sentry uses)
 *   - autocapture is on (every click/pageview/form-submit logged); we
 *     slice in the dashboard rather than naming events upfront
 *   - session recording masks all inputs by default — entries, vault
 *     content, and secret notes never reach PostHog
 *   - identify/reset are no-ops if the client hasn't loaded yet, so call
 *     sites don't need to know about consent or load state
 */
import type { PostHog } from "posthog-js";
import { getConsentDecision } from "../components/ConsentBanner";

let client: PostHog | null = null;

export async function initPostHog(): Promise<void> {
  if (client) return;
  if (getConsentDecision() !== "accepted") return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;
  const host = import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.i.posthog.com";

  // Dynamic import keeps the ~50KB posthog-js bundle out of the critical
  // path. Vite splits it into its own chunk, fetched only after consent.
  const { default: posthog } = await import("posthog-js");

  posthog.init(key, {
    api_host: host,
    // Only build full profiles for authed users — anonymous visitors stay
    // ephemeral, which keeps the active-user count honest and lowers cost.
    person_profiles: "identified_only",
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      // Privacy hard-stop: never capture what users type. Entries, vault
      // contents, secret notes, and search queries all flow through inputs
      // — masking is the only safe default for this product.
      maskAllInputs: true,
    },
  });
  client = posthog;
}

export function identifyPostHogUser(userId: string, email: string): void {
  client?.identify(userId, { email });
}

export function resetPostHog(): void {
  client?.reset();
}
