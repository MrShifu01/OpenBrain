import { useTheme } from "../ThemeContext";

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "capture", label: "Home", icon: "⌂" },
  { id: "grid", label: "Grid", icon: "◦" },
  { id: "suggest", label: "Fill", icon: "✦" },
  { id: "chat", label: "Ask", icon: "◈" },
  { id: "more", label: "More", icon: "≡" },
];

interface BottomNavProps {
  activeView: string;
  onNavigate: (viewId: string) => void;
}

export default function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  const { isDark } = useTheme();

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed right-0 bottom-0 left-0 z-[900] flex items-end justify-around border-t pb-[env(safe-area-inset-bottom,0px)] ${
        isDark
          ? "border-white/[0.06] bg-[rgba(18,18,24,0.88)]"
          : "border-black/[0.06] bg-[rgba(244,244,250,0.88)]"
      }`}
      style={{ backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`touch-target flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 border-none bg-none px-1 pt-2.5 pb-2 transition-all duration-150 [-webkit-tap-highlight-color:transparent] ${
              isActive ? "text-teal" : "text-ob-text-muted"
            }`}
          >
            {/* Active indicator pill */}
            <div
              className={`mb-0.5 h-[3px] w-5 rounded-full transition-all duration-200 ${
                isActive ? "bg-teal opacity-100" : "opacity-0"
              }`}
            />
            <span className={`text-[18px] leading-none ${isActive ? "font-bold" : "font-normal"}`}>
              {item.icon}
            </span>
            <span
              className={`text-[10px] tracking-[0.2px] ${isActive ? "font-semibold" : "font-medium"}`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
