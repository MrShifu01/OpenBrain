// Vault loading screen — shown while the hook decides whether the vault
// is fresh (setup), enrolled-but-locked, or already unlocked. Mirrors the
// locked-screen frame so the transition reads as "the vault, waking up"
// rather than an unrelated spinner. No props — this state is purely visual.

export function VaultLoading() {
  return (
    <div
      style={{
        height: "100%",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <header
        className="vault-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "18px 32px",
          borderBottom: "1px solid var(--line-soft)",
          minHeight: 72,
        }}
      >
        <div>
          <h1
            className="f-serif"
            style={{
              fontSize: 28,
              fontWeight: 450,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Vault
          </h1>
          <div
            className="f-serif"
            style={{
              fontSize: 14,
              color: "var(--ink-faint)",
              fontStyle: "italic",
              marginTop: 4,
            }}
          >
            checking the seal…
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient halo — same recipe as the locked state, but breathing
            so the page hints "still working" without a spinner. */}
        <div
          aria-hidden="true"
          className="vault-halo-breathe"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, var(--ember-wash) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            maxWidth: 360,
            textAlign: "center",
          }}
        >
          <div
            aria-hidden="true"
            className="vault-lock-pulse"
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--ember-wash)",
              border: "1px solid color-mix(in oklch, var(--ember) 28%, transparent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ember)",
            }}
          >
            <svg
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              viewBox="0 0 24 24"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
            </svg>
          </div>

          <p
            className="f-serif"
            style={{
              margin: 0,
              fontSize: 16,
              fontStyle: "italic",
              color: "var(--ink-soft)",
              lineHeight: 1.4,
            }}
          >
            your secrets are still where you left them.
          </p>

          <div
            aria-hidden="true"
            style={{
              display: "flex",
              gap: 6,
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="vault-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--ember)",
                  opacity: 0.35,
                  animationDelay: `${i * 160}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes vault-halo-breathe {
          0%, 100% { opacity: 0.30; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 0.55; transform: translate(-50%, -50%) scale(1.04); }
        }
        @keyframes vault-lock-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--ember) 28%, transparent); }
          50%      { box-shadow: 0 0 0 12px color-mix(in oklch, var(--ember) 0%, transparent); }
        }
        @keyframes vault-dot-fade {
          0%, 100% { opacity: 0.20; }
          50%      { opacity: 0.95; }
        }
        .vault-halo-breathe { animation: vault-halo-breathe 3.2s ease-in-out infinite; }
        .vault-lock-pulse   { animation: vault-lock-pulse 2.4s ease-out infinite; }
        .vault-dot          { animation: vault-dot-fade 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .vault-halo-breathe, .vault-lock-pulse, .vault-dot { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
