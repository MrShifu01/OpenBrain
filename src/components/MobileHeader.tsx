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
  brainEmoji,
  onToggleTheme,
  isDark,
  isOnline,
  pendingCount,
  children,
}: MobileHeaderProps) {
  return (
    <header className="bg-ob-bg flex items-center gap-3 px-5 py-4">
      {/* Brain identity */}
      <div className="gradient-accent flex h-10 w-10 min-w-10 items-center justify-center rounded-xl text-lg">
        {brainEmoji}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-ob-text overflow-hidden text-base font-bold text-ellipsis whitespace-nowrap">
          {brainName}
        </div>
        {(!isOnline || pendingCount > 0) && (
          <div
            className={`mt-0.5 text-[11px] font-medium ${!isOnline ? "text-ob-error" : "text-ob-accent"}`}
          >
            {!isOnline ? "Offline" : `${pendingCount} pending sync`}
          </div>
        )}
      </div>

      {/* Injected content (e.g. BrainSwitcher) */}
      {children}

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className="touch-target border-ob-border bg-ob-surface flex cursor-pointer items-center justify-center rounded-xl border p-0 text-lg [-webkit-tap-highlight-color:transparent]"
      >
        {isDark ? "\uD83C\uDF19" : "\u2600\uFE0F"}
      </button>
    </header>
  );
}
