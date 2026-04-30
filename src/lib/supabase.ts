import { AuthClient } from "@supabase/auth-js";
import { PostgrestClient } from "@supabase/postgrest-js";

// The browser only uses auth + one PostgREST table (user_ai_settings).
// It never uses Realtime, Storage, or Functions — every other DB call goes
// through /api/*. Importing auth-js + postgrest-js directly (instead of the
// full @supabase/supabase-js wrapper) drops realtime/storage/functions from
// the cold-load bundle.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Mirrors supabase-js: sb-<project-ref>-auth-token in localStorage, so
// existing sessions keep working without a migration.
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

const auth = new AuthClient({
  url: `${supabaseUrl}/auth/v1`,
  headers: {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  },
  storageKey: `sb-${projectRef}-auth-token`,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
});

// Defer Supabase token auto-refresh while the browser reports offline.
// Without this, the AuthClient's internal timer fires every ~10s while the
// user is offline, each call failing with "Failed to fetch" and burning
// retries. Worse, a failed refresh near token TTL boundary can blow away the
// session and force a sign-in once reconnected. Pausing while offline keeps
// the existing session alive; resuming on `online` triggers an immediate
// refresh on the next tick.
if (typeof window !== "undefined") {
  const handleOnline = () => {
    auth.startAutoRefresh().catch((err) => {
      console.warn("[supabase] startAutoRefresh failed", err);
    });
  };
  const handleOffline = () => {
    auth.stopAutoRefresh().catch((err) => {
      console.warn("[supabase] stopAutoRefresh failed", err);
    });
  };
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  // Apply current state on boot — `navigator.onLine` was false at module
  // load means we should already be paused.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    handleOffline();
  }
}

// Per-request token injection — matches supabase-js' fetchWithAuth so RLS
// sees the user's JWT after sign-in and falls back to the anon key when
// signed out.
async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { data } = await auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const headers = new Headers(init?.headers);
  if (!headers.has("apikey")) headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

const rest = new PostgrestClient(`${supabaseUrl}/rest/v1`, {
  headers: { apikey: anonKey },
  fetch: fetchWithAuth,
});

// Preserve the `.auth.*` and `.from(...)` surface so call sites don't change.
export const supabase = {
  auth,
  from: rest.from.bind(rest),
};
