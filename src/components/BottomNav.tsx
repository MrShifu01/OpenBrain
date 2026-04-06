import { useTheme } from "../ThemeContext";

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "capture", label: "Capture", icon: "+" },
  { id: "grid", label: "Grid", icon: "◦" },
  { id: "suggest", label: "Fill Brain", icon: "✦" },
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
      className={`border-ob-border fixed right-0 bottom-0 left-0 z-[900] flex items-center justify-around border-t pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-[20px] ${
        isDark ? "bg-[rgba(15,15,35,0.92)]" : "bg-[rgba(240,240,248,0.92)]"
      }`}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 border-none bg-none px-1 py-2 transition-colors duration-150 ease-in-out [-webkit-tap-highlight-color:transparent] ${
              isActive ? "text-ob-accent" : "text-ob-text-muted"
            }`}
          >
            <span className={`text-xl leading-none ${isActive ? "font-bold" : "font-normal"}`}>
              {item.icon}
            </span>
            <span
              className={`text-[10px] tracking-[0.3px] ${isActive ? "font-bold" : "font-medium"}`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
