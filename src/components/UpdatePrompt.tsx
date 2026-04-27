import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

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

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 250,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px 10px 16px",
        background: "var(--surface-high, #1a1a1a)",
        border: "1px solid var(--line, rgba(255,255,255,0.08))",
        borderRadius: 12,
        boxShadow: "0 12px 28px rgba(0,0,0,0.32)",
        fontFamily: "var(--f-sans, system-ui)",
        fontSize: 13,
        color: "var(--ink, #f0ede6)",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span>New version available.</span>
      <button
        onClick={() => updateSW?.(true)}
        className="press"
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid color-mix(in oklch, var(--ember, #c97a3c) 40%, transparent)",
          background: "var(--ember-wash, rgba(201, 122, 60, 0.12))",
          color: "var(--ember, #c97a3c)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Refresh
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: 0,
          color: "var(--ink-faint, #999)",
          cursor: "pointer",
          padding: 0,
          width: 24,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
