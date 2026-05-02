import { memo, useMemo } from "react";
import { NavIcon } from "./icons/NavIcons";
import { useKeyboardVisible } from "../hooks/useKeyboardVisible";
import { isFeatureEnabled, FEATURE_FLAGS, type FeatureFlagKey } from "../lib/featureFlags";

// 5-slot grid: capture FAB always anchors center. Side slots are flag-aware:
// when a feature is OFF in prod (e.g. Chat or Schedule) we drop the slot
// rather than render a tab that routes to an empty view (Everion.tsx redirects
// disabled views back to memory — without this filter, tapping the tab does
// nothing visible to the user).
// Sentinel id "_more" triggers the MobileMoreMenu sheet instead of navigating.
// Settings is reachable from inside that sheet, so giving it a dedicated tab
// here was duplication. More is also a better foothold for future destinations
// (Lists, Important, Vault) without the bottom bar overflowing.
const ALL_ITEMS = [
  { id: "memory", label: "Memory", icon: NavIcon.grid, flag: undefined },
  { id: "chat", label: "Chat", icon: NavIcon.chat, flag: "chat" as FeatureFlagKey },
  { id: "_capture_fab", label: "Add", isFAB: true, icon: NavIcon.add, flag: undefined },
  { id: "todos", label: "Schedule", icon: NavIcon.todos, flag: "todos" as FeatureFlagKey },
  { id: "_more", label: "More", icon: NavIcon.more, flag: undefined },
];

interface BottomNavProps {
  activeView: string;
  onNavigate: (id: string) => void;
  onCapture: () => void;
  onOpenMore: () => void;
  adminFlags?: Record<string, boolean>;
}

function BottomNavInner({
  activeView,
  onNavigate,
  onCapture,
  onOpenMore,
  adminFlags,
}: BottomNavProps) {
  const keyboardVisible = useKeyboardVisible();
  const navItems = useMemo(() => {
    const flags = adminFlags ?? {};
    return ALL_ITEMS.filter((item) => {
      if (!item.flag) return true;
      if (!(item.flag in FEATURE_FLAGS)) return true;
      return isFeatureEnabled(item.flag, flags);
    });
  }, [adminFlags]);
  if (keyboardVisible) return null;
  return (
    <nav
      aria-label="Primary navigation"
      className="bottom-nav-mobile"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: "var(--z-nav)",
        alignItems: "center",
        justifyContent: "space-around",
        background: "var(--surface-low)",
        borderTop: "1px solid var(--line-soft)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height: "calc(56px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {navItems.map((item) => {
        const isActive = activeView === item.id;

        if (item.isFAB) {
          return (
            <button
              key={item.id}
              onClick={onCapture}
              aria-label="New entry"
              className="press"
              style={{
                width: 56,
                height: 56,
                minHeight: 56,
                marginTop: -28,
                flexShrink: 0,
                borderRadius: "50%",
                background: "var(--ember)",
                color: "var(--ember-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--lift-2)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {item.icon}
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => (item.id === "_more" ? onOpenMore() : onNavigate(item.id))}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className="press"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              minHeight: 48,
              flex: 1,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: isActive ? "var(--ember)" : "var(--ink-faint)",
              transition: "color 180ms",
            }}
          >
            <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
            <span
              className="f-sans"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: isActive ? "var(--ember)" : "var(--ink-faint)",
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default memo(BottomNavInner);
