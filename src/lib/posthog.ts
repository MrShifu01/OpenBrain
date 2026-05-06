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
import { supabase } from "./supabase";

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
    // Disable session recording — pulls a separate ~120 KB recorder bundle
    // and uploads a continuous stream of mutation events for every user.
    // We don't review recordings as a routine debugging tool. Re-enable per
    // cohort via PostHog feature flag remote config when investigating a
    // specific UX issue. maskAllInputs is preserved as a safety belt for the
    // re-enable case (entries, vault content, secret notes flow through
    // inputs — never capture what users type).
    disable_session_recording: true,
    session_recording: { maskAllInputs: true },
    // Dead-clicks autocapture pulls another ~80 KB sub-bundle and we don't
    // action that data. Surveys are also unused — kill both.
    capture_dead_clicks: false,
    disable_surveys: true,
  });
  client = posthog;

  // If the user signed in before accepting consent, App.tsx already fired
  // identifyPostHogUser as a no-op. Re-attach that identity now so the
  // session isn't stranded as anonymous.
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (session?.user?.id) {
      posthog.identify(session.user.id, { email: session.user.email ?? "" });
    }
  } catch {
    // Best-effort — don't block PostHog init on a Supabase hiccup.
  }
}

export function identifyPostHogUser(userId: string, email: string): void {
  client?.identify(userId, { email });
}

export function resetPostHog(): void {
  client?.reset();
}

// Fire a named event. No-op if consent isn't granted or PostHog hasn't loaded
// yet — call sites stay simple and never need to gate. Properties are
// stringified by posthog-js; pass primitives or shallow objects only.
export function track(event: string, props?: Record<string, unknown>): void {
  client?.capture(event, props);
}
