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
    <header>
      {/* Left — logo */}
      <div>
        <span>psychology</span>
        <h1>{brainName}</h1>
      </div>

      {/* Status indicator */}
      {(!isOnline || pendingCount > 0) && (
        <div>
          {!isOnline ? (
            <>
              <span>wifi_off</span>
              <span>Offline</span>
            </>
          ) : (
            <>
              <span>sync</span>
              <span>{pendingCount} syncing</span>
            </>
          )}
        </div>
      )}

      {/* Right — brain switcher + theme toggle */}
      <div>
        {children}
        <button
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light" : "Switch to dark"}
        >
          <span>{isDark ? "light_mode" : "dark_mode"}</span>
        </button>
      </div>
    </header>
  );
}
