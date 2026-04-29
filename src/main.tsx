import { StrictMode, lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
// Vercel telemetry — lazy-imported so it never lands in the first-paint
// bundle for declined-cookie users (saves ~15 KB gzipped on cold load).
const SpeedInsights = lazy(() =>
  import("@vercel/speed-insights/react").then((m) => ({ default: m.SpeedInsights })),
);
const Analytics = lazy(() =>
  import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })),
);
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./ThemeContext";
import { DesignThemeProvider, applyInitialDesignTheme } from "./design/DesignThemeContext";
import ErrorBoundary from "./ErrorBoundary";
import PrivacyPolicy from "./views/PrivacyPolicy";
import TermsOfService from "./views/TermsOfService";
import NotFound from "./views/NotFound";
import { ConsentBanner, getConsentDecision } from "./components/ConsentBanner";
import UpdatePrompt from "./components/UpdatePrompt";
import { initPostHog } from "./lib/posthog";
import { initCapacitorBridge, hideSplashScreen, isNative } from "./lib/capacitorBridge";

// Paint the correct design family class on <html> before React mounts so the
// first frame uses the right theme tokens.
applyInitialDesignTheme();

// Load Google Fonts CSS via DOM injection rather than a render-blocking
// <link rel="stylesheet"> in index.html. The bytes are already in flight
// thanks to <link rel="preload" as="style"> in the HTML head, so this is
// effectively cache-warm. Why not the onload="this.media='all'" trick?
// CSP `script-src 'self'` blocks inline event handlers — captured by e2e
// when we tried it. JS injection is allowed, so do it from here.
(function loadFontsAsync() {
  const href =
    "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..600&family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..500&family=Inter+Tight:wght@400;450;500;600&family=Geist+Mono:wght@400;500&family=JetBrains+Mono:wght@400;500&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
})();

function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enabled: !!import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: false,
  });
}

// Init immediately if user already consented in a previous session
if (getConsentDecision() === "accepted") {
  initSentry();
  // Fire-and-forget — posthog-js is lazy-imported so this returns quickly
  // and the actual SDK loads in a separate chunk after the app is up.
  void initPostHog();
}

// When a new service worker takes control (after skipWaiting), reload so the
// fresh chunks are served instead of the stale cached ones.
// Native wrap doesn't use a SW (Capacitor serves bundled assets), so skip there.
if ("serviceWorker" in navigator && !isNative()) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

// Capacitor wrap — register deep-link + native network listeners as early
// as possible so a cold-start magic-link callback isn't dropped.
void initCapacitorBridge();

// Catch dynamic-import failures that happen outside React (e.g. an early
// lazy() route chunk fails before any boundary mounts). Without this, the
// page just dies silently with "Importing a module script failed". We
// unregister the SW + clear caches once per session, then reload.
function looksLikeStaleBundle(reason: unknown): boolean {
  const msg = reason instanceof Error ? reason.message : String(reason ?? "");
  return (
    /Loading chunk \d+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}
async function recoverFromStaleBundle(): Promise<void> {
  try {
    const KEY = "everion:sw-recovered";
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    // fall through
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_sw", Date.now().toString(36));
  window.location.replace(url.toString());
}
window.addEventListener("unhandledrejection", (e) => {
  if (looksLikeStaleBundle(e.reason)) void recoverFromStaleBundle();
});
window.addEventListener("error", (e) => {
  if (looksLikeStaleBundle(e.error ?? e.message)) void recoverFromStaleBundle();
});

const pathname = window.location.pathname;

function Root() {
  const [consent, setConsent] = useState(() => getConsentDecision());

  // Hide the native splash screen once the first render has committed.
  // No-op on web; on iOS/Android this fades out the launch image.
  useEffect(() => {
    void hideSplashScreen();
  }, []);

  function handleDecision(decision: "accepted" | "declined") {
    if (decision === "accepted") {
      initSentry();
      void initPostHog();
    }
    setConsent(decision);
  }

  if (pathname === "/privacy") return <PrivacyPolicy />;
  if (pathname === "/terms") return <TermsOfService />;

  // Known SPA paths fall through to <App />. Anything else is a 404.
  // (api/* and v1/* never reach the SPA; vercel.json strips them.)
  const KNOWN_PATHS = new Set(["/", "/login", "/admin"]);
  if (!KNOWN_PATHS.has(pathname)) return <NotFound />;

  return (
    <>
      <App />
      {consent === "accepted" && (
        <Suspense fallback={null}>
          <SpeedInsights />
          <Analytics />
        </Suspense>
      )}
      {consent === null && <ConsentBanner onDecision={handleDecision} />}
      <UpdatePrompt />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <DesignThemeProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </DesignThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
