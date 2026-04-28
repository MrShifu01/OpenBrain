// Auto-sync the user's IANA timezone to their notification prefs whenever
// the app boots. The browser already knows the user's timezone via
// Intl.DateTimeFormat — no IP geolocation needed, no third-party API.
// Result: a user who flies Johannesburg → New York gets their next
// "20:00 daily" reminder at New York's 20:00, not SAST 20:00.
//
// Runs once per session, fire-and-forget. If the user has explicitly
// overridden their tz in Settings, we still update — the source of truth
// is the device the user is actually on. Add an explicit "lock" flag
// later if power users push back.

import { authFetch } from "./authFetch";
import { supabase } from "./supabase";

const RAN_KEY = "everion_tz_sync_at";
const COOLDOWN_MS = 60 * 60 * 1000; // hourly is plenty

export async function syncTimezoneIfChanged(): Promise<void> {
  try {
    const last = Number(sessionStorage.getItem(RAN_KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected) return;

    const r = await authFetch("/api/notification-prefs");
    if (!r.ok) return;
    const prefs = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    const stored = (prefs?.daily_timezone as string | undefined) ?? null;

    if (stored === detected) {
      sessionStorage.setItem(RAN_KEY, String(Date.now()));
      return;
    }

    await authFetch("/api/notification-prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_timezone: detected,
        nudge_timezone: detected,
      }),
    });
    sessionStorage.setItem(RAN_KEY, String(Date.now()));
  } catch {
    // Silent — auto-sync is a nice-to-have. Manual override in Settings
    // remains the escape hatch.
  }
}
