import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

// Surfaces a "new version" toast when a fresh service worker finishes
// installing. Without this, users on an old SW can keep using stale chunks
// indefinitely after a deploy — and worse, a chunk request that hits a
// rotated hash 404s silently. registerType is 'prompt' (vite.config.js)
// so the new SW waits for an explicit skipWaiting before activating.
//
// On click: updateSW() posts SKIP_WAITING; sw.js calls self.skipWaiting()
// + clients.claim(); main.tsx's controllerchange listener reloads.
//
// 2026-04-29: ported from a bespoke fixed-position div to a Sonner action
// toast. Sonner already mounts a Toaster in Everion.tsx so this component
// returns null on render — its only job is registering the SW listener
// and firing the toast when needRefresh fires.
//
// Native-gate: skip SW registration entirely inside Capacitor's WebView.
// Service workers + Capacitor have a long history of pain (cache mismatches,
// scope conflicts with the file:// origin on iOS, ghost SWs surviving app
// upgrades). Updates inside the native shell ride the App Store / Play
// release pipeline instead.

const TOAST_ID = "sw-update-prompt";

export default function UpdatePrompt() {
  // Cache the updateSW handle so re-renders don't re-register the listener.
  const updateSWRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const fn = registerSW({
      onNeedRefresh() {
        // Persistent toast (duration: Infinity) — refreshing is the user's
        // call. Action button triggers updateSW(true) which reloads the
        // page once the new SW takes control.
        toast("New version available.", {
          id: TOAST_ID,
          duration: Infinity,
          action: {
            label: "Refresh",
            onClick: () => {
              void updateSWRef.current?.(true);
            },
          },
        });
      },
      // onOfflineReady fires when the precache finishes on first install.
      // We deliberately don't surface that — it's not actionable to the user.
    });
    updateSWRef.current = fn;
  }, []);

  return null;
}
