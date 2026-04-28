// Auto-sync the user's IANA timezone to their notification prefs whenever
// the app boots OR auth state changes. The browser already knows the
// user's tz via Intl.DateTimeFormat — no IP geolocation, no third-party API.
// Result: a user who flies Johannesburg → New York gets their next
// "20:00 daily" reminder at New York's 20:00, not SAST 20:00.

import { authFetch } from "./authFetch";
import { supabase } from "./supabase";

const RAN_KEY = "everion_tz_synced_to";

// Returns the resolved IANA zone (e.g. "Africa/Johannesburg") or empty
// string if the runtime can't tell.
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

// Once-per-app-load tz sync. Hits the /api/notification-prefs endpoint and
// PATCHes daily_timezone + nudge_timezone if they don't match the device's
// detected zone. Visible failures via console — the cron depends on this
// being correct, so silent failure was the wrong default.
export async function syncTimezoneIfChanged(opts: { force?: boolean } = {}): Promise<void> {
  const detected = detectTimezone();
  if (!detected) return;

  // Skip if we already synced THIS detected zone this session.
  const synced = sessionStorage.getItem(RAN_KEY);
  if (!opts.force && synced === detected) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const r = await authFetch("/api/notification-prefs");
    if (!r.ok) {
      console.warn(`[tz-sync] GET prefs failed: ${r.status}`);
      return;
    }
    const prefs = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    const stored = (prefs?.daily_timezone as string | undefined) ?? null;

    if (stored === detected) {
      sessionStorage.setItem(RAN_KEY, detected);
      return;
    }

    const post = await authFetch("/api/notification-prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_timezone: detected,
        nudge_timezone: detected,
      }),
    });
    if (!post.ok) {
      console.warn(`[tz-sync] POST prefs failed: ${post.status}`);
      return;
    }
    sessionStorage.setItem(RAN_KEY, detected);
    console.info(`[tz-sync] ${stored ?? "(none)"} → ${detected}`);
  } catch (err) {
    console.warn("[tz-sync] failed:", err);
  }
}
