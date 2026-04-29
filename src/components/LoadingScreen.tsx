import type { JSX } from "react";

export default function LoadingScreen(): JSX.Element {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: "var(--color-background)", zIndex: "var(--z-loading)" }}
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
      </div>
    </div>
  );
}
