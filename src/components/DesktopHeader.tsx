import { useState, useEffect } from "react";
import type { AppNotification } from "../hooks/useNotifications";
import NotificationBell from "./NotificationBell";
import BrainSwitcher from "./BrainSwitcher";
import { isFeatureEnabled } from "../lib/featureFlags";
import { useAdminDevMode } from "../hooks/useAdminDevMode";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface DesktopHeaderProps {
  searchInput: string;
  onSearchChange: (v: string) => void;
  onNavigate: (id: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  notifications?: AppNotification[];
  unreadCount?: number;
  onDismissNotification?: (id: string) => void;
  onMarkNotificationRead?: (id: string) => void;
  onDismissAllNotifications?: () => void;
  onAcceptMerge?: (n: AppNotification) => void;
}

const SUN_ICON = (
  <svg
    aria-hidden="true"
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
);
const MOON_ICON = (
  <svg
    aria-hidden="true"
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
);
const SEARCH_ICON = (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
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
);

import { getCachedEmail } from "../lib/userEmailCache";

function readCachedEmail(): string {
  if (typeof window === "undefined") return "";
  return getCachedEmail();
}

export default function DesktopHeader({
  searchInput,
  onSearchChange,
  onNavigate,
  isDark,
  onToggleTheme,
  notifications = [],
  unreadCount = 0,
  onDismissNotification,
  onMarkNotificationRead,
  onDismissAllNotifications,
  onAcceptMerge,
}: DesktopHeaderProps) {
  const [email, setEmail] = useState(readCachedEmail);
  const { adminFlags } = useAdminDevMode();
  const showBrainSwitcher = isFeatureEnabled("multiBrain", adminFlags);

  // Email is cached lazily by SettingsView/AccountTab. Re-read on mount in
  // case the user signed in mid-session and the initial render captured "".
  useEffect(() => {
    const e = readCachedEmail();
    if (e && e !== email) setEmail(e);
  }, [email]);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header
      className="sticky top-0 z-30 hidden lg:flex"
      style={{
        height: 60,
        alignItems: "center",
        gap: 16,
        padding: "0 28px",
        background: "color-mix(in oklch, var(--bg) 92%, transparent)",
        backdropFilter: "saturate(140%) blur(12px)",
        WebkitBackdropFilter: "saturate(140%) blur(12px)",
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      {showBrainSwitcher && <BrainSwitcher />}

      {/* Search — opens OmniSearch on Cmd/Ctrl+/, also feeds the memory grid
          filter (same wiring as the old sidebar search). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          flex: "1 1 auto",
          maxWidth: 520,
          padding: "0 10px 0 12px",
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 8,
          color: "var(--ink-faint)",
          transition: "border-color 180ms",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor =
            "color-mix(in oklch, var(--ember) 35%, var(--line-soft))")
        }
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-soft)")}
      >
        {SEARCH_ICON}
        {/* Honeypot inputs absorb Chrome's eager username/password autofill
            before it reaches the real search field. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", left: -10000, width: 1, height: 1, opacity: 0 }}
        />
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", left: -10000, width: 1, height: 1, opacity: 0 }}
        />
        <input
          type="search"
          name="everion-header-q"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+/ opens the global OmniSearch overlay. (Cmd+K is
            // bound to capture — see Everion.tsx.)
            if ((e.metaKey || e.ctrlKey) && e.key === "/") {
              e.preventDefault();
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "/", metaKey: true, bubbles: true }),
              );
            }
          }}
          placeholder="Search everything…"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--f-sans)",
            fontSize: 13,
            color: "var(--ink)",
          }}
        />
        {searchInput ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                style={{ color: "var(--ink-faint)" }}
              >
                ×
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear search</TooltipContent>
          </Tooltip>
        ) : (
          <kbd
            aria-hidden="true"
            style={{
              fontFamily: "var(--f-sans)",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--ink-ghost)",
              background: "var(--surface-low)",
              border: "1px solid var(--line-soft)",
              borderRadius: 4,
              padding: "2px 6px",
              lineHeight: 1,
            }}
          >
            {isMac ? "⌘/" : "Ctrl /"}
          </kbd>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right cluster — notifications, theme, profile */}
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              style={{ color: "var(--ink-soft)" }}
            >
              {isDark ? SUN_ICON : MOON_ICON}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onNavigate("settings")}
              aria-label={email ? `Account — ${email}` : "Account"}
              className="ml-1.5 rounded-full"
              style={{
                background: "var(--ember-wash)",
                color: "var(--ember)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ display: "block" }}
              >
                <circle cx="12" cy="10" r="3.5" />
                <path d="M6 18.5c1-2.7 3.4-4.2 6-4.2s5 1.5 6 4.2" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{email || "Account"}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
