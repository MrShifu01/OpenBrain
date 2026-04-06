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

  const sidebarBg    = isDark ? "#131313" : "#f5f5f5";
  const borderColor  = isDark ? "rgba(72,72,71,0.18)" : "rgba(0,0,0,0.08)";
  const textPrimary  = isDark ? "#ffffff" : "#1a1a1a";
  const textVariant  = isDark ? "#adaaaa" : "#6b7280";

  return (
    <aside
      className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-[800] w-[240px] select-none"
      style={{
        background: sidebarBg,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRight: `1px solid ${borderColor}`,
      }}
    >
      {/* ── Header: brand + brain switcher ── */}
      <div
        className="px-5 pt-6 pb-4"
        style={{ borderBottom: `1px solid ${borderColor}` }}
      >
        {/* Logo row */}
        <div className="flex items-center gap-2.5 mb-4">
          <span
            className="material-symbols-outlined mat-filled"
            style={{ fontSize: 30, color: "#72eff5" }}
          >
            psychology
          </span>
          <span
            className="text-xl font-bold tracking-tight truncate"
            style={{ fontFamily: "'Manrope', sans-serif", color: textPrimary }}
          >
            OpenBrain
          </span>
        </div>

        {/* Brain name + status */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex-1 min-w-0 text-[13px] font-medium truncate"
            style={{ color: textVariant }}
          >
            {activeBrainName}
          </div>
          {!isOnline && (
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14, color: "#ff6e84" }}
            >
              wifi_off
            </span>
          )}
          {isOnline && pendingCount > 0 && (
            <span
              className="material-symbols-outlined animate-spin"
              style={{ fontSize: 14, color: "#72eff5", animationDuration: "1.5s" }}
            >
              sync
            </span>
          )}
        </div>

        {/* Brain switcher */}
        {children}
      </div>

      {/* ── Navigation items ── */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
        {allItems.map((item) => {
          const isActive = view === item.id;
          const matIcon  = ICON_MAP[item.id] || "circle";

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className="w-full flex items-center gap-3.5 px-5 py-3 text-left cursor-pointer border-none bg-transparent transition-all duration-150"
              style={{
                background: isActive
                  ? isDark ? "rgba(31,177,183,0.12)" : "rgba(8,145,178,0.08)"
                  : "transparent",
                color: isActive
                  ? isDark ? "#72eff5" : "#0891b2"
                  : textVariant,
                borderLeft: isActive
                  ? `2px solid ${isDark ? "#72eff5" : "#0891b2"}`
                  : "2px solid transparent",
              }}
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{
                  fontSize: 20,
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {matIcon}
              </span>
              <span
                className="text-[13px] leading-snug"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {item.l}
              </span>
              {item.id === "suggest" && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#ff6b35" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div
        className="px-4 pb-5 pt-4"
        style={{ borderTop: `1px solid ${borderColor}` }}
      >
        {/* Add Brain button */}
        <button
          onClick={onShowCreateBrain}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer border text-[12px] font-semibold mb-3 transition-opacity hover:opacity-80"
          style={{
            background: isDark ? "rgba(213,117,255,0.08)" : "rgba(147,51,234,0.06)",
            borderColor: "rgba(213,117,255,0.25)",
            color: "#d575ff",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Add Brain
        </button>

        {/* Stats + theme toggle */}
        <div className="flex items-center justify-between">
          <span
            className="text-[11px]"
            style={{ color: textVariant, fontFamily: "'Inter', sans-serif" }}
          >
            <span style={{ fontWeight: 600, color: isDark ? "#72eff5" : "#0891b2" }}>
              {entryCount}
            </span>
            {" "}memories
          </span>
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer border transition-all hover:scale-105 active:scale-95"
            style={{
              background: isDark ? "#262626" : "#f0f0f0",
              borderColor: isDark ? "rgba(72,72,71,0.3)" : "rgba(0,0,0,0.1)",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 15, color: textVariant }}
            >
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
