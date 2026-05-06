// Run a callback after the browser has finished its critical-path work for
// the first paint, so non-essential fetches (notifications, vault check,
// vault entries) don't share bandwidth + main-thread time with the data the
// user actually sees.
//
// Why not just setTimeout(0)? setTimeout fires before requestAnimationFrame
// commits the next paint, which puts the work back on the critical path.
// requestIdleCallback waits until the browser thinks it has spare time,
// which is exactly what we want.
//
// iOS Safari still doesn't ship requestIdleCallback (last checked early
// 2026). Fall back to a fixed setTimeout — pessimistic delay so we don't
// race the first paint on slow devices.

type IdleCallback = (cb: () => void, opts?: { timeout?: number }) => number;

export function idleSchedule(fn: () => void, fallbackDelayMs = 1500): void {
  if (typeof window === "undefined") return;
  const ric: IdleCallback | undefined = (
    window as unknown as { requestIdleCallback?: IdleCallback }
  ).requestIdleCallback;
  if (ric) ric(() => fn(), { timeout: 3000 });
  else setTimeout(fn, fallbackDelayMs);
}
