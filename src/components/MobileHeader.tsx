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
    <header className="bg-ob-bg flex items-center gap-3 px-4 py-3">
      {/* Brain identity */}
      <div className="gradient-accent flex h-9 w-9 min-w-9 items-center justify-center rounded-[10px] text-base">
        {brainEmoji}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-ob-text overflow-hidden text-[15px] font-bold text-ellipsis whitespace-nowrap">
          {brainName}
        </div>
        {(!isOnline || pendingCount > 0) && (
          <div
            className={`text-[10px] font-semibold ${!isOnline ? "text-ob-error" : "text-ob-accent"}`}
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
        className="border-ob-border bg-ob-surface flex h-11 min-h-11 w-11 min-w-11 cursor-pointer items-center justify-center rounded-[10px] border p-0 text-lg [-webkit-tap-highlight-color:transparent]"
      >
        {isDark ? "\uD83C\uDF19" : "\u2600\uFE0F"}
      </button>
    </header>
  );
}
