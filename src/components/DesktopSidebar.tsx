import type { ReactNode } from "react";

interface NavView {
  id: string;
  l: string;
  ic: string;
}

/* Material Symbol icon mapping */
const ICON_MAP: Record<string, string> = {
  capture:  "home",
  grid:     "grid_view",
  suggest:  "format_color_fill",
  refine:   "auto_awesome",
  todos:    "checklist",
  timeline: "schedule",
  vault:    "lock",
  chat:     "chat_bubble",
  settings: "settings",
  suppliers:"inventory_2",
};

const CAPTURE_NAV: NavView = { id: "capture", l: "Home", ic: "⌂" };

interface DesktopSidebarProps {
  activeBrainName: string;
  view: string;
  onNavigate: (id: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isOnline: boolean;
  pendingCount: number;
  entryCount: number;
  onShowCreateBrain: () => void;
  navViews: NavView[];
  children?: ReactNode; // BrainSwitcher
}

export default function DesktopSidebar({
  activeBrainName,
  view,
  onNavigate,
  isDark,
  onToggleTheme,
  isOnline,
  pendingCount,
  entryCount,
  onShowCreateBrain,
  navViews,
  children,
}: DesktopSidebarProps) {
  const allItems = [CAPTURE_NAV, ...navViews];

  return (
    <aside>
      {/* ── Header: brand + brain switcher ── */}
      <div>
        {/* Logo row */}
        <div>
          <span>psychology</span>
          <span>OpenBrain</span>
        </div>

        {/* Brain name + status */}
        <div>
          <div>{activeBrainName}</div>
          {!isOnline && <span>wifi_off</span>}
          {isOnline && pendingCount > 0 && <span>sync</span>}
        </div>

        {/* Brain switcher */}
        {children}
      </div>

      {/* ── Navigation items ── */}
      <nav>
        {allItems.map((item) => {
          const isActive = view === item.id;
          const matIcon  = ICON_MAP[item.id] || "circle";

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{matIcon}</span>
              <span>{item.l}</span>
              {item.id === "suggest" && <span />}
            </button>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div>
        {/* Add Brain button */}
        <button onClick={onShowCreateBrain}>
          <span>add</span>
          Add Brain
        </button>

        {/* Stats + theme toggle */}
        <div>
          <span>
            <span>{entryCount}</span>
            {" "}memories
          </span>
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            <span>{isDark ? "light_mode" : "dark_mode"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
