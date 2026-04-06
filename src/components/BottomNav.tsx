import { useTheme } from "../ThemeContext";

interface NavItem {
  id: string;
  label: string;
  icon: string;        // Material Symbol name
  iconFilled: string;  // filled variant (same name, toggled via FILL)
}

const NAV_ITEMS: NavItem[] = [
  { id: "capture", label: "Home",   icon: "home",              iconFilled: "home" },
  { id: "grid",    label: "Grid",   icon: "grid_view",         iconFilled: "grid_view" },
  { id: "suggest", label: "Fill",   icon: "format_color_fill", iconFilled: "format_color_fill" },
  { id: "chat",    label: "Ask",    icon: "chat_bubble",       iconFilled: "chat_bubble" },
  { id: "more",    label: "More",   icon: "more_horiz",        iconFilled: "more_horiz" },
];

interface BottomNavProps {
  activeView: string;
  onNavigate: (id: string) => void;
}

export default function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  const { isDark } = useTheme();

  return (
    /* Outer shell — hidden on desktop */
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[900] flex justify-center pb-[env(safe-area-inset-bottom,0px)] pb-3 px-4">
      <nav
        aria-label="Main navigation"
        className="w-full max-w-sm flex justify-around items-center py-1.5 rounded-2xl"
        style={{
          background: isDark ? "rgba(26,25,25,0.65)" : "rgba(255,255,255,0.75)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: isDark
            ? "0px 20px 40px rgba(0,0,0,0.4), 0px 0px 20px rgba(213,117,255,0.10)"
            : "0px 8px 32px rgba(0,0,0,0.12)",
          border: isDark ? "1px solid rgba(72,72,71,0.18)" : "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id ||
            (item.id === "more" && !["capture","grid","suggest","chat"].includes(activeView));
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl border-none bg-transparent cursor-pointer flex-1 min-h-[48px] transition-all duration-200 [-webkit-tap-highlight-color:transparent] active:scale-90"
              style={
                isActive
                  ? {
                      background: isDark ? "rgba(213,117,255,0.10)" : "rgba(147,51,234,0.08)",
                      color: isDark ? "#d575ff" : "#9333ea",
                    }
                  : {
                      color: isDark ? "#adaaaa" : "#9ca3af",
                    }
              }
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 22,
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  transition: "font-variation-settings 0.15s",
                }}
              >
                {item.icon}
              </span>
              <span
                className="text-[9px] uppercase tracking-[0.15em]"
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: isActive ? 700 : 500 }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
