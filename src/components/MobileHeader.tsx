import { useEffect, useState, type ReactNode } from "react";
import type { AppNotification } from "../hooks/useNotifications";
import NotificationBell from "./NotificationBell";
import BrainSwitcher from "./BrainSwitcher";
import MobileMoreMenu from "./MobileMoreMenu";
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
  onNavigate?: (id: string) => void;
  children?: ReactNode;
  notifications?: AppNotification[];
  unreadCount?: number;
  onDismissNotification?: (id: string) => void;
  onMarkNotificationRead?: (id: string) => void;
  onDismissAllNotifications?: () => void;
  onAcceptMerge?: (n: AppNotification) => void;
}

export default function MobileHeader({
  onToggleTheme: _onToggleTheme,
  isDark: _isDark,
  isOnline: _isOnline,
  pendingCount: _pendingCount,
  onSearch,
  onNavigate,
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Publish the header's hide state as a CSS var so other sticky bars
  // (e.g. settings mobile tabs) can sit flush at the top when the header
  // slides up — and back below it when the header reappears. The value
  // includes the safe-area inset so notched phones get the right offset.
  // With the active-brain card now sitting below the header bar, the
  // total height grows when multibrain is on.
  useEffect(() => {
    const root = document.documentElement;
    const baseHeight = showBrainSwitcher ? 116 : 56;
    root.style.setProperty(
      "--app-header-h",
      hidden ? "0px" : `calc(${baseHeight}px + env(safe-area-inset-top, 0px))`,
    );
    return () => {
      root.style.removeProperty("--app-header-h");
    };
  }, [hidden, showBrainSwitcher]);

  return (
    <div
      className="safe-top sticky top-0 z-30 lg:hidden"
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--line-soft)",
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform",
      }}
    >
      {/* Outer wrapper carries `.safe-top` (env(safe-area-inset-top)). Don't
          re-add it here — that double-counts the notch and pushes the brand
          ~60px below the safe area on devices with a sensor housing. */}
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        {/* Left: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <img
            src="/logoNew.webp"
            width={28}
            height={28}
            alt=""
            aria-hidden="true"
            decoding="async"
            style={{ flexShrink: 0, objectFit: "contain", display: "block" }}
          />
          <span
            className="f-serif"
            style={{
              fontSize: 18,
              fontWeight: 450,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            Everion
          </span>
          {children}
        </div>

        {/* Right: notifications, search, menu */}
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
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            style={{ color: "var(--ink-soft)" }}
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </Button>
        </div>
      </header>

      {showBrainSwitcher && (
        <div
          style={{
            padding: "0 14px 12px",
          }}
        >
          <BrainSwitcher cardMode />
        </div>
      )}

      <MobileMoreMenu
        isOpen={menuOpen}
        onNavigate={(id) => {
          setMenuOpen(false);
          if (id !== "close" && onNavigate) onNavigate(id);
        }}
      />
    </div>
  );
}
