import type { ReactNode } from "react";

interface MobileHeaderProps {
  brainName: string;
  brainEmoji: string;
  onToggleTheme: () => void;
  isDark: boolean;
  isOnline: boolean;
  pendingCount: number;
  children?: ReactNode;
}

export default function MobileHeader({
  brainName,
  onToggleTheme,
  isDark,
  isOnline,
  pendingCount,
  children,
}: MobileHeaderProps) {
  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-[800] flex items-center justify-between px-6 py-4"
      style={{
        background: isDark ? "rgba(14,14,14,0.65)" : "rgba(250,250,250,0.75)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: isDark ? "1px solid rgba(72,72,71,0.10)" : "1px solid rgba(0,0,0,0.05)",
      }}
    >
      {/* Left — logo */}
      <div className="flex items-center gap-2.5">
        <span
          className="material-symbols-outlined mat-filled"
          style={{ fontSize: 28, color: "#72eff5" }}
        >
          psychology
        </span>
        <h1
          className="text-xl font-bold tracking-tight"
          style={{
            fontFamily: "'Manrope', sans-serif",
            color: isDark ? "#ffffff" : "#1a1a1a",
          }}
        >
          {brainName}
        </h1>
      </div>

      {/* Status indicator */}
      {(!isOnline || pendingCount > 0) && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium mx-auto">
          {!isOnline ? (
            <>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 14, color: "#ff6e84" }}
              >
                wifi_off
              </span>
              <span style={{ color: "#ff6e84", fontFamily: "'Inter', sans-serif" }}>Offline</span>
            </>
          ) : (
            <>
              <span
                className="material-symbols-outlined animate-spin"
                style={{ fontSize: 14, color: "#72eff5", animationDuration: "1.5s" }}
              >
                sync
              </span>
              <span style={{ color: "#72eff5", fontFamily: "'Inter', sans-serif" }}>
                {pendingCount} syncing
              </span>
            </>
          )}
        </div>
      )}

      {/* Right — brain switcher + theme toggle */}
      <div className="flex items-center gap-2">
        {children}
        <button
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light" : "Switch to dark"}
          className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer border-none transition-colors duration-200"
          style={{
            background: isDark ? "rgba(38,38,38,0.8)" : "rgba(240,240,240,0.8)",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, color: isDark ? "#adaaaa" : "#6b7280" }}
          >
            {isDark ? "light_mode" : "dark_mode"}
          </span>
        </button>
      </div>
    </header>
  );
}
