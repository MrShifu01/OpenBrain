// Settings for the app-level lock (sub-project 4 of 5 in EML "Vault —
// beyond V3 narrow scope"). Reuses the same vault PIN/biometric records
// from src/lib/vaultPinKey.ts — there's no second PIN to remember.
//
// Idle timeout: same allowed values as the vault auto-lock (5/15/30/60 min).
// Defaults: enabled=false, timeout=15.

const ENABLED_KEY = "em_app_lock_enabled_v1";
const TIMEOUT_KEY = "em_app_lock_timeout_min_v1";

export type AppLockTimeoutMinutes = 5 | 15 | 30 | 60;

export function isAppLockEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAppLockEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    // unavailable
  }
}

export function getAppLockTimeoutMinutes(): AppLockTimeoutMinutes {
  try {
    const raw = localStorage.getItem(TIMEOUT_KEY);
    const n = raw ? parseInt(raw, 10) : 15;
    if (n === 5 || n === 15 || n === 30 || n === 60) return n;
  } catch {
    // unavailable
  }
  return 15;
}

export function setAppLockTimeoutMinutes(value: AppLockTimeoutMinutes): void {
  try {
    localStorage.setItem(TIMEOUT_KEY, String(value));
  } catch {
    // unavailable
  }
}
