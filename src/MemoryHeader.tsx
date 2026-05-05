import type { AppShellState } from "./hooks/useAppShell";
import NotificationBell from "./components/NotificationBell";
import type { AppNotification } from "./hooks/useNotifications";
import type { Entry } from "./types";
import { Button } from "./components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";

interface Props {
  appShell: AppShellState;
  // Pass the full entries array (was loosely typed as {length:number}) so the
  // header can count entries flagged with metadata.import_source for the
  // "From imports" toggle.
  entries: Entry[];
  entriesLoaded: boolean;
  activeBrainId: string | undefined;
  notifications?: AppNotification[];
  unreadCount?: number;
  onDismissNotification?: (id: string) => void;
  onMarkNotificationRead?: (id: string) => void;
  onDismissAllNotifications?: () => void;
  onAcceptMerge?: (n: AppNotification) => void;
}

export default function MemoryHeader({
  appShell,
  entries,
  entriesLoaded,
  activeBrainId,
  notifications = [],
  unreadCount = 0,
  onDismissNotification,
  onMarkNotificationRead,
  onDismissAllNotifications,
  onAcceptMerge,
}: Props) {
  return (
    // Sticky wrapper, top: 0 — main-content (the scroll container in the
    // signed-in shell, see commit a14d914) starts immediately below the
    // global app header, so sticky 0 pins this filter row at the top of
    // main-content's visible area (which is right under MobileHeader /
    // DesktopHeader on screen). The previous top: var(--app-header-h)
    // was sized for the old body-scroll layout where sticky was
    // calculated from screen top, not main-content top — that double-
    // counted the header height post-refactor and pushed the filter row
    // off-screen by ~163px until the user had scrolled enough that the
    // pinning kicked in mid-content. z-20 keeps it below the global
    // header layer (z-30).
    <div
      className="sticky top-0 z-20"
      style={{
        background: "var(--bg)",
      }}
    >
      {/* Memory top bar — title + Remember */}
      <header
        className="memory-topbar hidden lg:flex"
        style={{
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: "1px solid var(--line-soft)",
          minHeight: 80,
          background: "var(--bg)",
          gap: 20,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            className="f-serif"
            style={{
              fontSize: 28,
              fontWeight: 450,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Memory
          </h1>
          <div
            className="f-serif"
            style={{
              fontSize: 14,
              color: "var(--ink-faint)",
              fontStyle: "italic",
              marginTop: 4,
            }}
          >
            {entriesLoaded && entries.length > 0
              ? `${entries.length} entries`
              : "everything you've written down."}
          </div>
        </div>
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
        <Button onClick={() => appShell.setShowCapture(true)}>
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Capture
        </Button>
      </header>

      {/* Filter row — Grid/Timeline + type pills + sort */}
      <div
        className="memory-filter-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 32px",
          borderBottom: "1px solid var(--line-soft)",
          background: "var(--bg)",
          flexWrap: "wrap",
        }}
      >
        {/* Grid / List / Timeline segmented */}
        {(() => {
          const value =
            appShell.view === "timeline"
              ? "timeline"
              : appShell.gridViewMode === "list"
                ? "memory-list"
                : "memory-grid";
          return (
            <Tabs
              value={value}
              onValueChange={(v) => {
                appShell.setSelected(null);
                if (v === "timeline") {
                  appShell.setView("timeline");
                } else if (v === "memory-grid") {
                  appShell.setView("memory");
                  appShell.setGridViewMode("grid");
                } else {
                  appShell.setView("memory");
                  appShell.setGridViewMode("list");
                }
              }}
            >
              <TabsList
                aria-label="View mode"
                className="border border-[var(--line-soft)] bg-[var(--surface-low)]"
              >
                <TabsTrigger value="memory-grid">Grid</TabsTrigger>
                <TabsTrigger value="memory-list">List</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
            </Tabs>
          );
        })()}

        {/* vertical rule */}
        <span
          aria-hidden="true"
          style={{ width: 1, height: 22, background: "var(--line-soft)", flexShrink: 0 }}
        />

        <div style={{ flex: 1 }} />

        {/* From imports toggle — only renders when there's something to filter to.
            Reuses entryFilters.importSource so the filter is applied wherever
            applyEntryFilters is called. */}
        {(() => {
          const importedCount = entries.filter((e) => {
            const src = (e.metadata as Record<string, unknown> | undefined)?.import_source;
            return typeof src === "string" && src.length > 0;
          }).length;
          if (importedCount === 0) return null;
          const active = appShell.gridFilters.importSource === "any";
          return (
            <Button
              size="sm"
              variant={active ? "default" : "ghost"}
              aria-pressed={active}
              onClick={() =>
                appShell.setGridFilters({
                  ...appShell.gridFilters,
                  importSource: active ? undefined : "any",
                  brainId: activeBrainId,
                })
              }
            >
              From imports
              <span style={{ opacity: 0.7, fontSize: 12 }}>{importedCount.toLocaleString()}</span>
            </Button>
          );
        })()}

        {/* Select mode toggle */}
        {appShell.view === "memory" && (
          <Button
            size="sm"
            variant={appShell.selectMode ? "default" : "ghost"}
            aria-pressed={appShell.selectMode}
            onClick={appShell.toggleSelectMode}
          >
            Select
          </Button>
        )}

        {/* Sort cycle */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const order: Array<"newest" | "oldest" | "pinned"> = ["newest", "oldest", "pinned"];
            const idx = order.indexOf(appShell.gridFilters.sort);
            const next = order[(idx + 1) % order.length];
            appShell.setGridFilters({
              ...appShell.gridFilters,
              sort: next,
              brainId: activeBrainId,
            });
          }}
        >
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" />
          </svg>
          {appShell.gridFilters.sort === "oldest"
            ? "Oldest first"
            : appShell.gridFilters.sort === "pinned"
              ? "Pinned first"
              : "Recent first"}
        </Button>
      </div>
    </div>
  );
}
