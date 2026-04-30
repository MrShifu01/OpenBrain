import { useEffect, useState } from "react";

// Calm full-page offline state. Mounts when the app boots without network AND
// without a usable session. Used in two places:
//
//   1. Native wrap (Capacitor) — the WebView would otherwise render a
//      half-loaded login screen with no signal of why; this shows up
//      immediately with retry-on-online.
//   2. Web standalone PWA — the SW serves the shell but LoginScreen needs
//      a live Supabase auth round-trip to do anything. Without this, a
//      cold-start in airplane mode leaves the user staring at a frozen
//      sign-in form.
//
// The component subscribes to its own retry signal via the parent — pass
// `onRetry` so the parent re-attempts the fetch that decided to mount this.

interface OfflineScreenProps {
  onRetry?: () => void;
}

export default function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setRetrying(true);
      onRetry?.();
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [onRetry]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(env(safe-area-inset-top), 24px) 24px max(env(safe-area-inset-bottom), 24px)",
        background: "var(--bg, #FAF6EF)",
        zIndex: "var(--z-native-overlay)",
      }}
      role="alert"
      aria-live="polite"
    >
      <div
        style={{
          maxWidth: 360,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            margin: "0 auto",
            background: "var(--ember-wash, #FAEEDF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ember, #C7733B)",
            fontSize: 28,
          }}
        >
          ⌁
        </div>
        <h1
          className="f-serif"
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 400,
            color: "var(--ink, #1A1814)",
            letterSpacing: "-0.01em",
          }}
        >
          Everion can't connect right now.
        </h1>
        <p
          className="f-serif"
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--ink-soft, #5C544A)",
            fontStyle: "italic",
          }}
        >
          Your connection may be offline. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => {
            setRetrying(true);
            onRetry?.();
            // Drop the retrying state after a beat so the button isn't stuck
            // pressed if the parent doesn't unmount us immediately.
            window.setTimeout(() => setRetrying(false), 1500);
          }}
          className="press"
          style={{
            marginTop: 8,
            height: 36,
            padding: "0 18px",
            borderRadius: 999,
            border: "1px solid var(--ember, #C7733B)",
            background: "var(--ember, #C7733B)",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.01em",
            cursor: "pointer",
            alignSelf: "center",
          }}
        >
          {retrying ? "Trying…" : "Try again"}
        </button>
      </div>
    </div>
  );
}
