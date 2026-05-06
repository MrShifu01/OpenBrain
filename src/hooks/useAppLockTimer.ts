// App-level idle-lock timer. Listens to user activity events at the
// document level; if there's been no activity for `timeoutMinutes`,
// fires `onIdle()` which the app-lock gate uses to flip into the locked
// state.
//
// Sub-project 4 of 5 in EML "Vault — beyond V3 narrow scope".

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "touchstart", "scroll", "click"] as const;
const THROTTLE_MS = 1000;

export function useAppLockTimer({
  enabled,
  timeoutMinutes,
  onIdle,
}: {
  enabled: boolean;
  timeoutMinutes: number;
  onIdle: () => void;
}) {
  const lastBumpRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const restart = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onIdleRef.current();
      }, timeoutMinutes * 60_000);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastBumpRef.current < THROTTLE_MS) return;
      lastBumpRef.current = now;
      restart();
    };

    restart();

    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, onActivity, { passive: true });
    }

    // Tab-visibility — when the page is hidden, treat that as "idle starts now"
    // so a quick tab-away doesn't burn through the whole timeout. When it
    // becomes visible again, restart the timer fresh.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else {
        restart();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      for (const ev of ACTIVITY_EVENTS) {
        document.removeEventListener(ev, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, timeoutMinutes]);
}
