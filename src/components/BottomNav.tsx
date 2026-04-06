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
    <div>
      <nav aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id ||
            (item.id === "more" && !["capture","grid","suggest","chat"].includes(activeView));
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
