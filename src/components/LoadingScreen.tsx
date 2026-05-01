import { useEffect, useState, type JSX } from "react";

const STUCK_AFTER_MS = 15000;

async function nukeAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    /* fall through */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_sw", Date.now().toString(36));
  window.location.replace(url.toString());
}

export default function LoadingScreen(): JSX.Element {
  // Escape hatch — when LoadingScreen sits visible past STUCK_AFTER_MS the
  // boot is wedged (lazy-chunk hang, frozen auth-js, stuck SW cache). Show
  // a tap-to-reload affordance so the user isn't forced to force-quit. The
  // tap clears the SW + caches, then bypasses any cached HTML via a cache-
  // busting query param. If the boot was about to recover on its own, the
  // user just sees the prompt for a frame and ignores it.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: "var(--bg, var(--color-background))",
        bottom: "calc(-1 * env(safe-area-inset-bottom, 0px))",
        minHeight: "calc(100dvh + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        zIndex: "var(--z-loading)",
      }}
    >
      <div className="synapse-bg" />
      <div className="grain" />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        {/* Orbital brain orb */}
        <div style={{ position: "relative", width: 104, height: 104 }}>
          <div
            style={{
              position: "absolute",
              inset: -10,
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 22%, transparent), color-mix(in oklch, var(--color-tertiary) 18%, transparent), transparent 70%)",
              filter: "blur(16px)",
              borderRadius: "50%",
              animation: "hero-glow 3s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)",
              animation: "ring-pulse 2.6s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: -12,
              borderRadius: "50%",
              border: "1px dashed color-mix(in oklch, var(--color-tertiary) 20%, transparent)",
              animation: "orbital-spin 18s linear infinite",
            }}
          />
          <div
            className="glass-panel"
            style={{
              position: "relative",
              width: 104,
              height: 104,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)",
            }}
          >
            <img
              src="/logoNew.webp"
              width={104 * 0.78}
              height={104 * 0.78}
              alt=""
              aria-hidden="true"
              decoding="async"
              style={{ objectFit: "contain", display: "block" }}
            />
          </div>
        </div>

        {/* Brand */}
        <h1
          className="font-headline gradient-text glow-text"
          style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em" }}
        >
          Everion Mind
        </h1>

        {/* Loading bar */}
        <div
          style={{
            height: 1,
            width: 112,
            overflow: "hidden",
            borderRadius: 999,
            background: "var(--color-outline-variant)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "50%",
              borderRadius: 999,
              background: "var(--color-primary)",
              animation: "loading-sweep 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite",
            }}
          />
        </div>

        {stuck && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            <p
              className="f-sans"
              style={{
                fontSize: 13,
                color: "var(--ink-soft, #888)",
                margin: 0,
                textAlign: "center",
                maxWidth: 260,
                lineHeight: 1.4,
              }}
            >
              Taking longer than usual.
            </p>
            <button
              type="button"
              onClick={nukeAndReload}
              className="press-scale f-sans"
              style={{
                height: 36,
                padding: "0 20px",
                borderRadius: 999,
                background: "var(--color-primary)",
                color: "var(--color-on-primary)",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              Force refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
