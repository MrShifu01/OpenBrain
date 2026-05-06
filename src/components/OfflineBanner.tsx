// OfflineBanner — single source of truth for the user's network state.
//
// Two modes, picked by the worse-of-two state:
//   1. offline           → red-ish blood accent, "You're offline" + "X queued"
//   2. online + queue>0  → ember accent, "Syncing X queued change(s)…"
//
// Renders nothing when online + queue empty. Slim, fixed at the top, designed
// to coexist with the sidebar (lg:ml-60) and the mobile header. Honours the
// project design tokens — no native UI, no hard-coded colours.

interface OfflineBannerProps {
  isOnline: boolean;
  pendingCount: number;
}

export default function OfflineBanner({ isOnline, pendingCount }: OfflineBannerProps) {
  if (isOnline && pendingCount === 0) return null;

  const isOffline = !isOnline;
  const accent = isOffline ? "var(--blood)" : "var(--ember)";
  const wash = isOffline
    ? "color-mix(in oklch, var(--blood) 14%, var(--surface))"
    : "color-mix(in oklch, var(--ember) 12%, var(--surface))";

  let label: string;
  if (isOffline && pendingCount > 0) {
    label =
      pendingCount === 1
        ? "You're offline · 1 change queued"
        : `You're offline · ${pendingCount} changes queued`;
  } else if (isOffline) {
    label = "You're offline · changes save locally and sync when reconnected";
  } else {
    label =
      pendingCount === 1 ? "Syncing 1 queued change…" : `Syncing ${pendingCount} queued changes…`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="f-sans"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: "var(--z-native-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "6px 14px",
        background: wash,
        borderBottom: `1px solid color-mix(in oklch, ${accent} 35%, transparent)`,
        color: accent,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.01em",
        // Make sure the visible chip never covers the iOS notch — mobile header
        // has its own safe-area handling and we don't want to fight it.
        paddingTop: "max(6px, env(safe-area-inset-top))",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: accent,
          flexShrink: 0,
          // Pulse on offline so it's clear something's off.
          animation: isOffline ? "offline-banner-pulse 1.6s ease-in-out infinite" : undefined,
        }}
      />
      <span>{label}</span>
      <style>{`@keyframes offline-banner-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }`}</style>
    </div>
  );
}
