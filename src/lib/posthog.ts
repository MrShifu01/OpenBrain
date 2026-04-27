/**
 * PostHog wrapper — mirrors the Sentry consent gate in main.tsx.
 *
 *   - init only fires after the user has accepted the analytics consent
 *     banner (same `everion_analytics_consent` key Sentry uses)
 *   - autocapture is on (every click/pageview/form-submit logged); we
 *     slice in the dashboard rather than naming events upfront
 *   - session recording masks all inputs by default — entries, vault
 *     content, and secret notes never reach PostHog
 *   - identify/reset are no-ops if init hasn't fired yet, so call sites
 *     don't need to know about consent state
 */
import posthog from "posthog-js";
import { getConsentDecision } from "../components/ConsentBanner";

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (getConsentDecision() !== "accepted") return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;
  const host = import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.i.posthog.com";

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
  initialized = true;
}

export function identifyPostHogUser(userId: string, email: string): void {
  if (!initialized) return;
  posthog.identify(userId, { email });
}

export function resetPostHog(): void {
  if (!initialized) return;
  posthog.reset();
}
