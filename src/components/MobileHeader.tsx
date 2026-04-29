import { useEffect, useState, type ReactNode } from "react";
import type { AppNotification } from "../hooks/useNotifications";
import NotificationBell from "./NotificationBell";
import BrainSwitcher from "./BrainSwitcher";
import { isFeatureEnabled } from "../lib/featureFlags";
import { useAdminDevMode } from "../hooks/useAdminDevMode";
import { Button } from "./ui/button";

// Auto-hide on scroll-down, slide back in on scroll-up. Mirrors the
// pattern shipping in Mail / Twitter / Instagram — gives users back the
// vertical real estate while scrolling without losing access to search
// / bell / brain switcher (a flick up brings the header right back).
//
// Threshold of 60px means the first short scroll never triggers a hide,
// only a meaningful intent to read deeper. Tiny dy gates (>4 / <-4) kill
// jitter from rubber-band on iOS.
function useHideOnScroll(threshold = 60): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (y > threshold && dy > 4) setHidden(true);
        else if (dy < -4 || y < threshold) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return hidden;
}

interface MobileHeaderProps {
  onToggleTheme: () => void;
  isDark: boolean;
  isOnline: boolean;
  pendingCount: number;
  onSearch?: () => void;
  children?: ReactNode;
  notifications?: AppNotification[];
  unreadCount?: number;
  onDismissNotification?: (id: string) => void;
  onMarkNotificationRead?: (id: string) => void;
  onDismissAllNotifications?: () => void;
  onAcceptMerge?: (n: AppNotification) => void;
}

export default function MobileHeader({
  onToggleTheme,
  isDark,
  isOnline: _isOnline,
  pendingCount: _pendingCount,
  onSearch,
  children,
  notifications = [],
  unreadCount = 0,
  onDismissNotification,
  onMarkNotificationRead,
  onDismissAllNotifications,
  onAcceptMerge,
}: MobileHeaderProps) {
  const { adminFlags } = useAdminDevMode();
  const showBrainSwitcher = isFeatureEnabled("multiBrain", adminFlags);
  const hidden = useHideOnScroll();

  // Publish the header's hide state as a CSS var so other sticky bars
  // (e.g. settings mobile tabs) can sit flush at the top when the header
  // slides up — and back below it when the header reappears. The value
  // includes the safe-area inset so notched phones get the right offset.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--app-header-h",
      hidden ? "0px" : "calc(56px + env(safe-area-inset-top, 0px))",
    );
    return () => {
      root.style.removeProperty("--app-header-h");
    };
  }, [hidden]);

  return (
    <header
      className="safe-top sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 lg:hidden"
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--line-soft)",
        paddingTop: "max(14px, env(safe-area-inset-top))",
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform",
      }}
    >
      {/* Left: brand + brain */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d="M8.5 3a3.5 3.5 0 0 0-3.5 3.5c-1.5.5-2.5 2-2.5 3.5 0 1 .5 2 1.5 2.5-.5.8-.5 2 0 3 .3.6.8 1 1.5 1.3-.2.9.1 2 .8 2.7.8.7 2 1 3 .5.3 1 1.3 2 2.7 2A2.5 2.5 0 0 0 14.5 20V4.5A1.5 1.5 0 0 0 13 3M15.5 3A3.5 3.5 0 0 1 19 6.5c1.5.5 2.5 2 2.5 3.5 0 1-.5 2-1.5 2.5.5.8.5 2 0 3-.3.6-.8 1-1.5 1.3.2.9-.1 2-.8 2.7-.8.7-2 1-3 .5-.3 1-1.3 2-2.7 2A2.5 2.5 0 0 1 9.5 20V4.5A1.5 1.5 0 0 1 11 3" />
        </svg>
        <span
          className="f-serif"
          style={{ fontSize: 17, fontWeight: 450, letterSpacing: "-0.01em", color: "var(--ink)" }}
        >
          Everion
        </span>
        {showBrainSwitcher && <BrainSwitcher compact />}
        {children}
      </div>

      {/* Right: notifications, search, theme */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        {onDismissNotification && (
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onDismiss={onDismissNotification}
            onMarkRead={onMarkNotificationRead ?? (() => {})}
            onDismissAll={onDismissAllNotifications ?? (() => {})}
            onAcceptMerge={onAcceptMerge ?? (() => {})}
          />
        )}
        {onSearch && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSearch}
            aria-label="Search"
            style={{ color: "var(--ink-soft)" }}
          >
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{ color: "var(--ink-soft)" }}
        >
          {isDark ? (
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
            </svg>
          )}
        </Button>
      </div>
    </header>
  );
}
