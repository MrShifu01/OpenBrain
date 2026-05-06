// Dormant auto-lock — wipes the in-memory vault key after N minutes of
// inactivity. Resets the countdown on any decryption event (toggle reveal,
// copy, add secret, etc.).
//
// Sub-project 3 of 5 in EML "Vault — beyond V3 narrow scope".

import { useEffect, useRef } from "react";

const LOCK_TIMEOUT_KEY = "em_vault_lock_timeout_min";
const DEFAULT_MIN = 15;

export type LockTimeoutMinutes = 5 | 15 | 30 | 60;

export function getLockTimeoutMinutes(): LockTimeoutMinutes {
  try {
    const raw = localStorage.getItem(LOCK_TIMEOUT_KEY);
    const n = raw ? parseInt(raw, 10) : DEFAULT_MIN;
    if (n === 5 || n === 15 || n === 30 || n === 60) return n;
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_MIN;
}

export function setLockTimeoutMinutes(value: LockTimeoutMinutes): void {
  try {
    localStorage.setItem(LOCK_TIMEOUT_KEY, String(value));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Calls onLock once after `timeoutMinutes` of no `bump()` calls. Each
 * bump() restarts the timer. Pass enabled=false to disable entirely.
 */
export function useVaultLockTimer({
  enabled,
  timeoutMinutes,
  onLock,
}: {
  enabled: boolean;
  timeoutMinutes: LockTimeoutMinutes;
  onLock: () => void;
}): { bump: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const bump = () => {
    if (!enabled) {
      clear();
      return;
    }
    clear();
    timerRef.current = setTimeout(() => {
      onLockRef.current();
    }, timeoutMinutes * 60_000);
  };

  useEffect(() => {
    if (!enabled) {
      clear();
      return;
    }
    bump();
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timeoutMinutes]);

  return { bump };
}
