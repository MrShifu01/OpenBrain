import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { Button } from "./ui/button";

// Surfaces a "new version" toast when a fresh service worker finishes
// installing. Without this, users on an old SW can keep using stale chunks
// indefinitely after a deploy — and worse, a chunk request that hits a
// rotated hash 404s silently. registerType is 'prompt' (vite.config.js)
// so the new SW waits for an explicit skipWaiting before activating.
//
// On click: updateSW() posts SKIP_WAITING; sw.js calls self.skipWaiting()
// + clients.claim(); main.tsx's controllerchange listener reloads.
export default function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fn = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      // onOfflineReady fires when the precache finishes on first install.
      // We deliberately don't surface that — it's not actionable to the user.
    });
    setUpdateSW(() => fn);
  }, []);

  if (!needRefresh) return null;

  function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    // updateSW(true) triggers SKIP_WAITING + a full page reload as soon as
    // the new SW takes control, so the spinner only ever shows for ~200ms
    // before the navigation happens. The state still matters as a guard
    // against double-click triggering two reloads.
    void updateSW?.(true);
  }

  return (
    <>
      <style>{`@keyframes ob-update-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: "var(--z-update-prompt)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px 10px 16px",
          background: "var(--surface-high, #1a1a1a)",
          border: "1px solid var(--line, rgba(255,255,255,0.08))",
          borderRadius: 12,
          boxShadow: "var(--shadow-lg)",
          fontFamily: "var(--f-sans, system-ui)",
          fontSize: 13,
          color: "var(--ink, #f0ede6)",
          maxWidth: "calc(100vw - 24px)",
          width: "max-content",
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>New version available.</span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="min-w-[92px] border-[color-mix(in_oklch,var(--ember)_40%,transparent)] bg-[var(--ember-wash)] text-[var(--ember)]"
        >
          {refreshing ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                style={{ animation: "ob-update-spin 0.8s linear infinite" }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="40"
                  strokeDashoffset="20"
                  opacity="0.85"
                />
              </svg>
              Refreshing…
            </>
          ) : (
            "Refresh"
          )}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setNeedRefresh(false)}
          disabled={refreshing}
          aria-label="Dismiss"
        >
          ×
        </Button>
      </div>
    </>
  );
}
