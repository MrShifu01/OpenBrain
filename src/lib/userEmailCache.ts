/**
 * Single source of truth for the current user's email cached in localStorage.
 *
 * Several places need to know the email synchronously during render — the
 * admin chip gate on every EntryCard, the email shown in the sidebar, the
 * sign-out flow. Going through supabase.auth.getUser() in those paths costs
 * an async call per render, so SettingsView writes the email here once on
 * load and the cheap sync readers all consume it.
 *
 * Centralising the read/write lets every call site share one key spelling
 * and one try/catch — easier to audit and impossible to typo "everion_email"
 * differently across files.
 */

const KEY = "everion_email";
const ADMIN_KEY = "everion_is_admin";

export function getCachedEmail(): string {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setCachedEmail(email: string | null | undefined): void {
  try {
    if (email && email.length > 0) {
      localStorage.setItem(KEY, email);
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // localStorage may throw in private mode or with disk-full — silent here
    // because the cache is a perf optimisation, never a correctness gate.
  }
}

/**
 * Cache the is_admin flag derived from auth session app_metadata. Written
 * once on auth load by the bootstrap path; read sync by render-time
 * consumers (EntryList admin chip gate). Authoritative gate is server-side
 * — this is purely UI hint visibility.
 */
export function getCachedIsAdmin(): boolean {
  try {
    return localStorage.getItem(ADMIN_KEY) === "true";
  } catch {
    return false;
  }
}

export function setCachedIsAdmin(isAdmin: boolean): void {
  try {
    if (isAdmin) {
      localStorage.setItem(ADMIN_KEY, "true");
    } else {
      localStorage.removeItem(ADMIN_KEY);
    }
  } catch {
    // localStorage may throw in private mode or with disk-full — silent here
    // because the cache is a perf optimisation, never a correctness gate.
  }
}
