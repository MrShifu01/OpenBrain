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
      className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b glass-panel-dark"
      style={{
        borderColor: "rgba(72,72,71,0.10)",
        paddingTop: "max(12px, env(safe-area-inset-top))",
      }}
    >
      {/* Left — Logo + brain name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(114,239,245,0.15), rgba(213,117,255,0.15))",
            border: "1px solid rgba(114,239,245,0.2)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#72eff5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.67 2.84-1.72 3.75A5 5 0 0 1 17 15a5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 1.72-3.75A5 5 0 0 1 7 7a5 5 0 0 1 5-5z"/>
            <circle cx="12" cy="12" r="1.5" fill="#72eff5" stroke="none"/>
          </svg>
        </div>
        <h1
          className="font-bold text-on-surface truncate text-base"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {brainName}
        </h1>
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-1">
        {!isOnline && (
          <span
            className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full mr-1"
            style={{ color: "#ff6e84", background: "rgba(255,110,132,0.1)" }}
          >
            Offline
          </span>
        )}
        {isOnline && pendingCount > 0 && (
          <span
            className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full mr-1"
            style={{ color: "#72eff5", background: "rgba(114,239,245,0.1)" }}
          >
            Syncing
          </span>
        )}

        {/* Brain switcher slot */}
        {children}

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all press-scale"
        >
          {isDark ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
