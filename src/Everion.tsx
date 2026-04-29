import { useMemo, useRef, useEffect, useCallback, useState, lazy, Suspense } from "react";
import { useTheme } from "./ThemeContext";
import { authFetch } from "./lib/authFetch";
import { registerTypeIcon } from "./lib/typeIcons";
import { useBrain as useBrainHook } from "./hooks/useBrain";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { useNudge } from "./hooks/useNudge";
import { searchIndex, indexEntryConcepts, scoreEntry } from "./lib/searchIndex";
import { applyEntryFilters, getEntryTypes } from "./lib/entryFilters";
import { inferWorkspace } from "./lib/workspaceInfer";
import { EntriesContext } from "./context/EntriesContext";
import { BrainContext } from "./context/BrainContext";
import { ConceptGraphProvider, useConceptGraph } from "./context/ConceptGraphContext";
import { NudgeBanner } from "./components/NudgeBanner";
import { UsageWarningBanner } from "./components/UsageWarningBanner";
import { BackgroundTaskToast } from "./components/BackgroundTaskToast";
import { BackgroundOpsToast } from "./components/BackgroundOpsToast";
import { BackgroundOpsProvider } from "./hooks/useBackgroundOps";
import { useBackgroundCapture } from "./hooks/useBackgroundCapture";
import { useStagedCount } from "./hooks/useStagedCount";
import { VirtualGrid, VirtualTimeline } from "./components/EntryList";
import BulkActionBar from "./components/BulkActionBar";
import OnboardingModal from "./components/OnboardingModal";
import BottomNav from "./components/BottomNav";
import MobileHeader from "./components/MobileHeader";
const CaptureSheet = lazy(() => import("./components/CaptureSheet"));
import DesktopSidebar from "./components/DesktopSidebar";
import DesktopHeader from "./components/DesktopHeader";
import LoadingScreen from "./components/LoadingScreen";
import SkeletonCard from "./components/SkeletonCard";
import OmniSearch from "./components/OmniSearch";
import SettingsView from "./views/SettingsView";
const GraphView = lazy(() => import("./views/GraphView"));
import FloatingCaptureButton from "./components/FloatingCaptureButton";
import { Button } from "./components/ui/button";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import MemoryHeader from "./MemoryHeader";
import CaptureWelcomeScreen from "./CaptureWelcomeScreen";
import ErrorBoundary from "./ErrorBoundary";
import ViewError from "./components/ViewError";
import { useNotifications } from "./hooks/useNotifications";
import { useAppShell, type AppShellState } from "./hooks/useAppShell";
import { useDataLayer } from "./hooks/useDataLayer";
import { useEntryRealtime } from "./hooks/useEntryRealtime";
import { useBrain } from "./context/BrainContext";
import { useEntries } from "./context/EntriesContext";
import type { Entry } from "./types";
import { useAdminDevMode } from "./hooks/useAdminDevMode";
import { isFeatureEnabled, FEATURE_FLAGS, type FeatureFlagKey } from "./lib/featureFlags";
import { syncTimezoneIfChanged } from "./lib/syncTimezone";
import { supabase } from "./lib/supabase";

// Retry dynamic imports once on failure (stale chunk hash after deploy)
function lazyRetry(fn: () => Promise<any>) {
  return lazy(() =>
    fn()
      .then((mod) => {
        sessionStorage.removeItem("chunk_reload");
        return mod;
      })
      .catch(() => {
        if (!sessionStorage.getItem("chunk_reload")) {
          sessionStorage.setItem("chunk_reload", "1");
          window.location.reload();
          return new Promise(() => {}); // never resolves — page is reloading
        }
        return fn(); // second attempt after reload
      }),
  );
}

const TodoView = lazyRetry(() => import("./views/TodoView"));
const DetailModal = lazyRetry(() => import("./views/DetailModal"));
const VaultView = lazyRetry(() => import("./views/VaultView"));
const ImportantMemoriesView = lazyRetry(() => import("./views/ImportantMemoriesView"));
const ChatView = lazyRetry(() => import("./views/ChatView"));
const VaultRevealModal = lazyRetry(() => import("./components/VaultRevealModal"));
function Loader() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SkeletonCard count={3} />
    </div>
  );
}

const NAV_VIEWS = [
  { id: "memory", l: "Memory", ic: "▦" },
  { id: "chat", l: "Chat", ic: "💬" },
  { id: "graph", l: "Graph", ic: "✦" },
  { id: "todos", l: "Schedule", ic: "✓" },
  { id: "memories", l: "Important", ic: "★" },
  { id: "vault", l: "Vault", ic: "🔐" },
];

// ─── EverionContent ──────────────────────────────────────────────────────────
// Reads context (BrainContext, EntriesContext, ConceptGraphContext) + receives
// appShell and the few values that don't belong in any context.

interface EverionContentProps {
  appShell: AppShellState;
  cryptoKey: CryptoKey | null;
  handleVaultUnlock: (key: CryptoKey | null) => void;
  handleCreated: (entry: Entry) => void;
  handleCreatedBulk: (entry: Entry) => void;
  lastAction: any;
  setLastAction: (a: any) => void;
  saveError: string | null;
  setSaveError: (e: string | null) => void;
  handleUndo: () => void;
  commitPendingDelete: () => void;
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
  isOnline: boolean;
  pendingCount: number;
  failedOps: any[];
  clearFailedOps: () => void;
  canWrite: boolean;
  nudge: any;
  setNudge: (n: any) => void;
  bgTasks: any[];
  bgProcessFiles: (
    files: File[],
    brainId: string | undefined,
    onCreated: (e: Entry) => void,
  ) => void;
  bgQueueDirectSave: (
    entry: {
      title: string;
      content: string;
      type: string;
      tags: string[];
      metadata: Record<string, any>;
      rawContent?: string;
    },
    brainId: string | undefined,
    onCreated: (e: Entry) => void,
  ) => void;
  bgDismissTask: (id: string) => void;
  bgDismissAll: () => void;
  filtered: Entry[];
  sortedTimeline: Entry[];
  availableEntryTypes: string[];
  vaultEntries: Entry[];
  loadError: string | null;
}

function EverionContent({
  appShell,
  cryptoKey,
  handleVaultUnlock,
  handleCreated,
  handleCreatedBulk,
  lastAction,
  setLastAction,
  saveError,
  setSaveError,
  handleUndo,
  commitPendingDelete,
  setEntries,
  isOnline,
  pendingCount,
  failedOps,
  clearFailedOps,
  canWrite,
  nudge,
  setNudge,
  bgTasks,
  bgProcessFiles,
  bgQueueDirectSave,
  bgDismissTask,
  bgDismissAll,
  filtered,
  sortedTimeline,
  availableEntryTypes: _availableEntryTypes,
  vaultEntries,
  loadError,
}: EverionContentProps) {
  const { activeBrain, brains, setActiveBrain: _setActiveBrain, refresh: _refresh } = useBrain();
  const { entries, entriesLoaded, selected, setSelected, handleDelete, handleUpdate } =
    useEntries();
  const notifs = useNotifications();
  const [selectedVaultEntry, setSelectedVaultEntry] = useState<Entry | null>(null);

  // Save errors are transient — surface via sonner instead of inline banner.
  useEffect(() => {
    if (!saveError) return;
    const id = toast.error(saveError, {
      duration: 6000,
      onDismiss: () => setSaveError(null),
      onAutoClose: () => setSaveError(null),
    });
    return () => {
      toast.dismiss(id);
    };
  }, [saveError, setSaveError]);

  // Soft-delete undo — replaces the bespoke <UndoToast/> component with a
  // Sonner action toast. lastAction.type === "delete" means an entry has
  // been removed from the in-memory list but the DB row hasn't been hard-
  // deleted yet (commitPendingDelete fires when the toast auto-closes).
  // 5-second window matches the previous UNDO_TOAST_MUTATE_MS duration.
  useEffect(() => {
    if (!lastAction || lastAction.type !== "delete") return;
    const id = toast("Entry deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          handleUndo();
          setLastAction(null);
        },
      },
      onAutoClose: () => {
        commitPendingDelete();
        setLastAction(null);
      },
      onDismiss: () => {
        commitPendingDelete();
        setLastAction(null);
      },
    });
    return () => {
      toast.dismiss(id);
    };
  }, [lastAction, handleUndo, commitPendingDelete, setLastAction]);

  const handleEntrySelect = useCallback(
    (entry: Entry) => {
      if (entry.type === "secret") {
        setSelectedVaultEntry(entry);
      } else {
        setSelected(entry);
      }
    },
    [setSelected],
  );

  const allEntries = useMemo(() => [...entries, ...vaultEntries], [entries, vaultEntries]);
  const stagedCount = useStagedCount();
  const { conceptMap, godNodes } = useConceptGraph();
  const { isDark, toggleTheme } = useTheme();
  const { isAdmin, adminFlags } = useAdminDevMode();
  const ff = (key: FeatureFlagKey) => isFeatureEnabled(key, adminFlags);
  const visibleNavViews = NAV_VIEWS.filter(
    (v) => !(v.id in FEATURE_FLAGS) || ff(v.id as FeatureFlagKey),
  );

  // If the active view gets disabled, fall back to memory
  useEffect(() => {
    if (appShell.view in FEATURE_FLAGS && !ff(appShell.view as FeatureFlagKey)) {
      appShell.setView("memory");
    }
  }, [adminFlags, appShell.view, appShell.setView]);

  // Auto-sync IANA timezone on mount AND on every auth state change.
  // Mount alone misses the case where the app loads pre-auth and the
  // useEffect closure has already fired by the time the session lands.
  useEffect(() => {
    syncTimezoneIfChanged();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        syncTimezoneIfChanged();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Toast deep-link: when the gmail-scan toast's "Review" CTA fires, switch
  // to Settings and tell GmailSyncTab to open its staging inbox. Two-stage
  // event so the tab has time to mount before being asked to open the inbox.
  useEffect(() => {
    function handleOpenGmailInbox() {
      appShell.setView("settings");
      // 60ms gives SettingsView time to lazy-mount GmailSyncTab.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("everion:open-staging-inbox"));
      }, 60);
    }
    window.addEventListener("everion:open-gmail-inbox", handleOpenGmailInbox);
    return () => window.removeEventListener("everion:open-gmail-inbox", handleOpenGmailInbox);
  }, [appShell]);

  // Index concept names into the search index so grid search finds entries by concept
  useEffect(() => {
    if (!conceptMap) return;
    Object.entries(conceptMap).forEach(([entryId, concepts]) => {
      indexEntryConcepts(entryId, concepts);
    });
  }, [conceptMap]);

  // Cmd/Ctrl+K opens the capture sheet — matches the keyboard hint shown
  // on the floating capture button. Cmd/Ctrl+N kept as an alias for muscle
  // memory. Search now lives on Cmd/Ctrl+/, see OmniSearch.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "n")) {
        e.preventDefault();
        appShell.setShowCapture(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appShell.setShowCapture]);

  return (
    <>
      {/*
        Skip-to-main-content link — keyboard users can jump past the
        sidebar/header tree in one Tab. `sr-only` keeps it invisible until
        focused; `focus:not-sr-only` brings it into view as a styled chip.
        Counterpart `id="main-content"` is on the view-content wrapper below.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only"
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: "var(--z-native-overlay)",
          padding: "8px 14px",
          background: "var(--ember-wash)",
          color: "var(--ember)",
          border: "1px solid color-mix(in oklch, var(--ember) 40%, transparent)",
          borderRadius: 8,
          fontFamily: "var(--f-sans)",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Skip to main content
      </a>
      <div className="synapse-bg" />
      <div className="grain" />
      <DesktopSidebar
        activeBrainName={activeBrain?.name || "Everion"}
        view={appShell.view}
        onNavigate={(id) => {
          appShell.setSelected(null);
          appShell.setShowCapture(false);
          appShell.setView(id);
        }}
        onCapture={() => appShell.setShowCapture(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        isOnline={isOnline}
        pendingCount={pendingCount}
        entryCount={entries.length}
        onShowCreateBrain={() => {}}
        navViews={visibleNavViews}
        inboxCount={stagedCount}
        searchInput={appShell.searchInput}
        onSearchChange={appShell.setSearchInput}
      ></DesktopSidebar>

      <div className="w-full overflow-x-hidden">
        <div className="bg-background min-h-dvh lg:ml-60 lg:max-w-[calc(100vw-240px)]">
          <MobileHeader
            onToggleTheme={toggleTheme}
            isDark={isDark}
            isOnline={isOnline}
            pendingCount={pendingCount}
            onSearch={() =>
              // OmniSearch listens on Cmd/Ctrl+/ since capture moved to Cmd+K.
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "/", metaKey: true, bubbles: true }),
              )
            }
            onNavigate={appShell.setView}
            notifications={notifs.notifications}
            unreadCount={notifs.unreadCount}
            onDismissNotification={notifs.dismiss}
            onMarkNotificationRead={notifs.markRead}
            onDismissAllNotifications={notifs.dismissAll}
            onAcceptMerge={notifs.acceptMerge}
          ></MobileHeader>

          <DesktopHeader
            searchInput={appShell.searchInput}
            onSearchChange={appShell.setSearchInput}
            onNavigate={appShell.setView}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            notifications={notifs.notifications}
            unreadCount={notifs.unreadCount}
            onDismissNotification={notifs.dismiss}
            onMarkNotificationRead={notifs.markRead}
            onDismissAllNotifications={notifs.dismissAll}
            onAcceptMerge={notifs.acceptMerge}
          />

          {appShell.view === "memory" && nudge && (
            <NudgeBanner
              nudge={nudge}
              onDismiss={() => {
                setNudge(null);
                localStorage.setItem("openbrain_nudge_dismissed", Date.now().toString());
                localStorage.removeItem("openbrain_nudge");
              }}
            />
          )}
          {(appShell.view === "memory" || appShell.view === "chat") && (
            <UsageWarningBanner onNavigate={appShell.setView} />
          )}
          {failedOps.length > 0 && (
            <div
              className="mx-4 mt-2 flex items-center gap-3 rounded-2xl border p-3"
              style={{
                background: "color-mix(in oklch, var(--color-error) 8%, transparent)",
                borderColor: "color-mix(in oklch, var(--color-error) 20%, transparent)",
              }}
            >
              <span className="text-error flex-1 text-sm">
                {failedOps.length} operation{failedOps.length > 1 ? "s" : ""} failed to sync
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => clearFailedOps()}
                className="text-on-surface-variant hover:text-on-surface press-scale text-xs"
              >
                Dismiss
              </Button>
            </div>
          )}

          <OmniSearch
            entries={allEntries}
            onSelect={handleEntrySelect}
            onNavigate={appShell.setView}
            showGraph={ff("graph")}
            concepts={godNodes.map((c: any) => ({
              id: c.id,
              label: c.label,
              count: Array.isArray(c.source_entries) ? c.source_entries.length : undefined,
              source_entries: c.source_entries,
            }))}
          />
          <div id="main-content" key={appShell.view} className="animate-view-enter" tabIndex={-1}>
            {(appShell.view === "memory" || appShell.view === "timeline") && (
              <>
                <MemoryHeader
                  appShell={appShell}
                  entries={entries}
                  entriesLoaded={entriesLoaded}
                  activeBrainId={activeBrain?.id}
                  notifications={notifs.notifications}
                  unreadCount={notifs.unreadCount}
                  onDismissNotification={notifs.dismiss}
                  onMarkNotificationRead={notifs.markRead}
                  onDismissAllNotifications={notifs.dismissAll}
                  onAcceptMerge={notifs.acceptMerge}
                />

                {appShell.view === "timeline" && ff("timeline") && (
                  <div className="mx-auto max-w-4xl px-4 pt-4 pb-32 sm:px-6 lg:pb-8">
                    <VirtualTimeline
                      sorted={sortedTimeline}
                      setSelected={handleEntrySelect}
                      typeIcons={appShell.typeIcons}
                    />
                  </div>
                )}
                {appShell.view === "memory" && (
                  <div className="mx-auto max-w-6xl space-y-3 px-4 pt-4 pb-32 sm:px-6 lg:pb-8">
                    {!entriesLoaded ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <SkeletonCard count={6} />
                      </div>
                    ) : entries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
                        {isAdmin && loadError && (
                          <div
                            className="w-full rounded-xl border px-4 py-3 text-left font-mono text-xs"
                            style={{
                              background: "color-mix(in oklch, var(--color-error) 8%, transparent)",
                              borderColor:
                                "color-mix(in oklch, var(--color-error) 25%, transparent)",
                              color: "var(--color-error)",
                            }}
                          >
                            <strong>Admin — entries load error:</strong> {loadError}
                          </div>
                        )}
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: "50%",
                            background: "var(--ember-wash)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="24"
                            height="24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                            style={{ color: "var(--ember)" }}
                          >
                            <path d="M5 19c3-9 8-14 14-14-1 6-4 12-12 14M8 12l4 4" />
                          </svg>
                        </div>
                        <h2
                          className="f-serif"
                          style={{
                            fontSize: 28,
                            fontWeight: 400,
                            letterSpacing: "-0.01em",
                            color: "var(--ink)",
                            margin: 0,
                          }}
                        >
                          Your brain is empty.
                        </h2>
                        <p
                          className="f-serif"
                          style={{
                            fontSize: 16,
                            fontStyle: "italic",
                            color: "var(--ink-soft)",
                            margin: 0,
                            maxWidth: 380,
                            lineHeight: 1.5,
                          }}
                        >
                          Capture your first thing — or import what you've already written down.
                        </p>
                        <p
                          className="f-sans"
                          style={{
                            fontSize: 13,
                            color: "var(--ink-faint)",
                            margin: 0,
                            maxWidth: 420,
                            lineHeight: 1.55,
                          }}
                        >
                          A note, a link, a gate code, a policy number, a half-formed idea. Anything
                          worth not losing.
                        </p>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "center",
                            marginTop: 4,
                          }}
                        >
                          <Button onClick={() => appShell.openCapture()} className="press">
                            + Capture a thought
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => appShell.setView("settings")}
                            className="press"
                          >
                            Import from somewhere…
                          </Button>
                        </div>

                        <div style={{ marginTop: 24, width: "100%", maxWidth: 480 }}>
                          <div
                            className="micro"
                            style={{ marginBottom: 10, color: "var(--ink-faint)" }}
                          >
                            try one of these to see how it works
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              justifyContent: "center",
                            }}
                          >
                            {[
                              "the gate code Mom always forgets",
                              "when does my driver's licence expire",
                              "the customer call insight from Tuesday",
                              "where I hid the spare key",
                            ].map((example) => (
                              <button
                                key={example}
                                type="button"
                                onClick={() => appShell.openCapture(example)}
                                className="design-chip f-sans press"
                                style={{ fontSize: 12, cursor: "pointer" }}
                              >
                                {example}
                              </button>
                            ))}
                          </div>
                        </div>

                        {ff("vault") && (
                          <button
                            type="button"
                            onClick={() => appShell.setView("vault")}
                            className="press"
                            style={{
                              marginTop: 28,
                              padding: "14px 18px",
                              background: "var(--surface)",
                              border: "1px solid var(--ember)",
                              borderRadius: 14,
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              maxWidth: 420,
                            }}
                          >
                            <div
                              className="f-serif"
                              style={{
                                fontSize: 14,
                                fontWeight: 450,
                                color: "var(--ink)",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: "var(--ember)",
                                }}
                              />
                              Set up your vault
                            </div>
                            <div
                              className="f-serif"
                              style={{
                                fontSize: 12,
                                color: "var(--ink-soft)",
                                fontStyle: "italic",
                                lineHeight: 1.45,
                              }}
                            >
                              For the high-stakes stuff — IDs, bank details, "if I die" notes.
                              End-to-end encrypted, server can't read it.
                            </div>
                          </button>
                        )}
                      </div>
                    ) : filtered.length > 0 ? (
                      <>
                        <VirtualGrid
                          filtered={filtered}
                          setSelected={appShell.selectMode ? () => {} : handleEntrySelect}
                          typeIcons={appShell.typeIcons}
                          onPin={(e) =>
                            e.type !== "secret" && handleUpdate(e.id, { pinned: !e.pinned })
                          }
                          onDelete={(e) => e.type !== "secret" && handleDelete(e.id)}
                          selectMode={appShell.selectMode}
                          selectedIds={appShell.selectedIds}
                          onToggleSelect={appShell.toggleSelectId}
                          viewMode={appShell.gridViewMode}
                          conceptMap={conceptMap}
                        />
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <h3
                          className="f-serif"
                          style={{
                            fontSize: 22,
                            fontWeight: 450,
                            letterSpacing: "-0.005em",
                            color: "var(--ink)",
                            margin: 0,
                          }}
                        >
                          nothing matches.
                        </h3>
                        <p
                          className="f-serif"
                          style={{
                            fontSize: 15,
                            fontStyle: "italic",
                            color: "var(--ink-faint)",
                            margin: 0,
                            maxWidth: 320,
                            lineHeight: 1.5,
                          }}
                        >
                          try a looser word. or a feeling.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => appShell.setShowCapture(true)}
                          className="press"
                          style={{ marginTop: 8 }}
                        >
                          Capture something new
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {appShell.view === "chat" && ff("chat") && (
              <ErrorBoundary
                name="ChatView"
                fallback={(error, reset) => <ViewError view="Chat" error={error} onReset={reset} />}
              >
                <Suspense fallback={<Loader />}>
                  <ChatView brainId={activeBrain?.id} onNavigate={appShell.setView} />
                </Suspense>
              </ErrorBoundary>
            )}
            {appShell.view === "graph" && ff("graph") && (
              <ErrorBoundary
                name="GraphView"
                fallback={(error, reset) => (
                  <ViewError view="Graph" error={error} onReset={reset} />
                )}
              >
                <Suspense fallback={<Loader />}>
                  <GraphView openEntry={setSelected} />
                </Suspense>
              </ErrorBoundary>
            )}
            {appShell.view === "todos" && ff("todos") && (
              <ErrorBoundary
                name="TodoView"
                fallback={(error, reset) => (
                  <ViewError view="Schedule" error={error} onReset={reset} />
                )}
              >
                <Suspense fallback={<Loader />}>
                  <TodoView
                    entries={entries}
                    typeIcons={appShell.typeIcons}
                    activeBrainId={activeBrain?.id}
                    somedayEnabled={ff("someday")}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
            {appShell.view === "memories" && ff("importantMemories") && (
              <ErrorBoundary
                name="ImportantMemoriesView"
                fallback={(error, reset) => (
                  <ViewError view="Important" error={error} onReset={reset} />
                )}
              >
                <Suspense fallback={<Loader />}>
                  <ImportantMemoriesView brainId={activeBrain?.id} />
                </Suspense>
              </ErrorBoundary>
            )}
            {appShell.view === "vault" && ff("vault") && (
              <ErrorBoundary
                name="VaultView"
                fallback={(error, reset) => (
                  <ViewError view="Vault" error={error} onReset={reset} />
                )}
              >
                <Suspense fallback={<Loader />}>
                  <VaultView
                    entries={entries}
                    onSelect={setSelected}
                    cryptoKey={cryptoKey}
                    onVaultUnlock={handleVaultUnlock}
                    brainId={activeBrain?.id}
                    onEntryCreated={(e: Entry) => setEntries((prev) => [e, ...prev])}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
            {appShell.view === "settings" && <SettingsView onNavigate={appShell.setView} />}
            {appShell.view === "capture" && (
              <ErrorBoundary
                name="CaptureWelcomeScreen"
                fallback={(error, reset) => (
                  <ViewError view="Capture" error={error} onReset={reset} />
                )}
              >
                <CaptureWelcomeScreen
                  entriesLoaded={entriesLoaded}
                  entries={entries}
                  activeBrainName={activeBrain?.name}
                  typeIcons={appShell.typeIcons}
                  onNavigate={appShell.setView}
                  onSelectEntry={setSelected}
                />
              </ErrorBoundary>
            )}
          </div>

          {/* BulkActionBar lives OUTSIDE the animate-view-enter wrapper.
              That wrapper applies a transform which creates a stacking
              context and breaks `position: fixed` for descendants —
              the pill ends up pinned to the wrapper, not the viewport. */}
          {(appShell.view === "memory" || appShell.view === "timeline") &&
            appShell.selectMode &&
            appShell.selectedIds.size > 0 && (
              <BulkActionBar
                selectedIds={appShell.selectedIds}
                entries={entries}
                brains={brains}
                allSelected={appShell.selectedIds.size === filtered.length}
                onSelectAll={() => {
                  if (appShell.selectedIds.size === filtered.length) {
                    filtered.forEach((e) => {
                      if (appShell.selectedIds.has(e.id)) appShell.toggleSelectId(e.id);
                    });
                  } else {
                    filtered.forEach((e) => {
                      if (!appShell.selectedIds.has(e.id)) appShell.toggleSelectId(e.id);
                    });
                  }
                }}
                onDelete={async (ids: string[]) => {
                  for (const id of ids) {
                    setEntries((prev) => prev.filter((e) => e.id !== id));
                    await authFetch("/api/delete-entry", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id }),
                    }).catch((err) => console.error("[bulkDelete]", err));
                  }
                }}
                onDone={(updated) => {
                  setEntries((prev) => prev.map((e) => updated.find((u) => u.id === e.id) ?? e));
                  appShell.toggleSelectMode();
                }}
                onCancel={appShell.toggleSelectMode}
              />
            )}

          <Suspense fallback={null}>
            {selectedVaultEntry && (
              <VaultRevealModal
                entry={selectedVaultEntry}
                cryptoKey={cryptoKey}
                onClose={() => setSelectedVaultEntry(null)}
                onVaultUnlock={handleVaultUnlock}
                onGoToVault={() => {
                  setSelectedVaultEntry(null);
                  appShell.setView("vault");
                }}
              />
            )}
          </Suspense>

          <Suspense fallback={null}>
            {selected && (
              <DetailModal
                entry={selected}
                onClose={() => setSelected(null)}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                canWrite={canWrite}
                brains={brains}
                vaultUnlocked={!!cryptoKey}
                onTypeIconChange={(type: string, icon: string) => {
                  registerTypeIcon(activeBrain?.id ?? "", type, icon);
                  appShell.refreshTypeIcons();
                }}
              />
            )}
          </Suspense>

          <BackgroundTaskToast
            tasks={bgTasks}
            onDismiss={bgDismissTask}
            onDismissAll={bgDismissAll}
          />
          <BackgroundOpsToast />

          {appShell.showOnboarding && (
            <OnboardingModal
              onComplete={(opts) => {
                appShell.setShowOnboarding(false);
                if (opts?.nextAction === "vault") {
                  appShell.setView("vault");
                } else {
                  appShell.setView("memory");
                }
              }}
              brainId={activeBrain?.id}
            />
          )}

          <Suspense fallback={null}>
            <CaptureSheet
              isOpen={appShell.showCapture}
              onClose={() => {
                appShell.setShowCapture(false);
              }}
              onCreated={(e) => {
                handleCreated(e);
              }}
              brainId={activeBrain?.id}
              cryptoKey={cryptoKey}
              isOnline={isOnline}
              initialText={appShell.captureInitialText}
              onBackgroundFiles={(files) =>
                bgProcessFiles(files, activeBrain?.id, handleCreatedBulk)
              }
              onBackgroundSave={(entry) => {
                bgQueueDirectSave(entry, activeBrain?.id, handleCreated);
              }}
              onNavigate={(id) => {
                appShell.setShowCapture(false);
                appShell.setView(id);
              }}
              somedayEnabled={ff("someday")}
            />
          </Suspense>
          {appShell.view !== "capture" && !appShell.showCapture && (
            <FloatingCaptureButton onClick={() => appShell.setShowCapture(true)} />
          )}
          <BottomNav
            activeView={appShell.view}
            onNavigate={(id) => {
              setSelected(null);
              appShell.setShowCapture(false);
              appShell.setView(id);
            }}
            onCapture={() => appShell.setShowCapture(true)}
          />
        </div>
      </div>
    </>
  );
}

// ─── Everion ─────────────────────────────────────────────────────────────────
// Orchestrates all hooks, provides contexts, and delegates rendering to
// EverionContent (which calls useConceptGraph inside ConceptGraphProvider).

export default function Everion({ initialShowCapture }: { initialShowCapture?: boolean } = {}) {
  const { brains, activeBrain, setActiveBrain, refresh, loading: brainsLoading } = useBrainHook();

  const patchEntryIdRef = useRef<(tempId: string, realId: string) => void>(() => {});

  const { isOnline, pendingCount, sync, refreshCount, failedOps, clearFailedOps } = useOfflineSync({
    onEntryIdUpdate: useCallback(
      (tempId: string, realId: string) => patchEntryIdRef.current(tempId, realId),
      [],
    ),
  });

  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) sync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const appShell = useAppShell({ initialShowCapture, activeBrainId: activeBrain?.id });

  const dataLayer = useDataLayer({
    activeBrainId: activeBrain?.id,
    setSelected: appShell.setSelected,
    isOnline,
    isOnlineRef,
    refreshCount,
  });

  // Live-updates the chips and wave-dot as the server pipeline finishes
  // each step. Without this, dataLayer.entries only changes on refresh.
  useEntryRealtime(activeBrain?.id, dataLayer.setEntries);

  useEffect(() => {
    patchEntryIdRef.current = dataLayer.patchEntryId;
  }, [dataLayer.patchEntryId]);

  // Single-user app — all brains are owned by the authenticated user.
  // If multi-user support is added, wire this to brain membership/ownership.
  const canWrite = true;
  const { nudge, setNudge } = useNudge({
    entriesLoaded: dataLayer.entriesLoaded,
    entries: dataLayer.entries,
    activeBrain,
  });

  const {
    tasks: bgTasks,
    processFiles: bgProcessFiles,
    queueDirectSave: bgQueueDirectSave,
    dismissTask: bgDismissTask,
    dismissAll: bgDismissAll,
  } = useBackgroundCapture();

  // Persona facts live in the same `entries` table (so RAG and the concept
  // graph see them) but they're not "memories" — they belong in About You,
  // not in the Memory grid/list/timeline. Strip them out at the single
  // source so every downstream view (filtered, sortedTimeline, Bulk select,
  // search ranking) automatically excludes them.
  const allDisplayEntries = useMemo(
    () => [...dataLayer.entries, ...dataLayer.vaultEntries].filter((e) => e.type !== "persona"),
    [dataLayer.entries, dataLayer.vaultEntries],
  );

  const filtered = useMemo(() => {
    let r = allDisplayEntries;
    if (appShell.workspace !== "all")
      r = r.filter((e) => {
        const ws = inferWorkspace(e);
        return ws === appShell.workspace || ws === "both";
      });
    if (appShell.search) {
      const ids = searchIndex(appShell.search);
      if (ids) r = r.filter((e) => ids.has(e.id));
    }
    const result = applyEntryFilters(r, appShell.gridFilters);
    // When a search is active, override date/pinned sort with relevance ranking
    if (appShell.search) {
      result.sort((a, b) => scoreEntry(b, appShell.search) - scoreEntry(a, appShell.search));
    }
    return result;
  }, [appShell.search, appShell.gridFilters, appShell.workspace, allDisplayEntries]);

  const sortedTimeline = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
      ),
    [filtered],
  );

  const availableEntryTypes = useMemo(() => getEntryTypes(dataLayer.entries), [dataLayer.entries]);

  const entriesValue = useMemo(
    () => ({
      entries: dataLayer.entries,
      entriesLoaded: dataLayer.entriesLoaded,
      selected: appShell.selected,
      setSelected: appShell.setSelected,
      handleDelete: dataLayer.handleDelete,
      handleUpdate: dataLayer.handleUpdate,
      refreshEntries: dataLayer.refreshEntries,
    }),
    [
      dataLayer.entries,
      dataLayer.entriesLoaded,
      appShell.selected,
      appShell.setSelected,
      dataLayer.handleDelete,
      dataLayer.handleUpdate,
      dataLayer.refreshEntries,
    ],
  );

  const brainValue = useMemo(
    () => ({
      activeBrain,
      brains,
      setActiveBrain,
      refresh,
    }),
    [activeBrain, brains, setActiveBrain, refresh],
  );

  if (brainsLoading)
    return (
      <>
        <LoadingScreen />
        <Button
          size="icon-lg"
          onClick={() => appShell.setShowCapture(true)}
          aria-label="New entry"
          className="press-scale fixed bottom-5 left-1/2 z-[60] h-14 w-14 -translate-x-1/2 rounded-full lg:hidden"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-on-primary)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </Button>
      </>
    );

  return (
    <EntriesContext.Provider value={entriesValue}>
      <BrainContext.Provider value={brainValue}>
        <ConceptGraphProvider activeBrainId={activeBrain?.id}>
          <BackgroundOpsProvider>
            <TooltipProvider delayDuration={400}>
              <Toaster position="bottom-center" />
              <EverionContent
                appShell={appShell}
                cryptoKey={dataLayer.cryptoKey}
                handleVaultUnlock={dataLayer.handleVaultUnlock}
                handleCreated={dataLayer.handleCreated}
                handleCreatedBulk={dataLayer.handleCreatedBulk}
                lastAction={dataLayer.lastAction}
                setLastAction={dataLayer.setLastAction}
                saveError={dataLayer.saveError}
                setSaveError={dataLayer.setSaveError}
                handleUndo={dataLayer.handleUndo}
                commitPendingDelete={dataLayer.commitPendingDelete}
                setEntries={dataLayer.setEntries}
                isOnline={isOnline}
                pendingCount={pendingCount}
                failedOps={failedOps}
                clearFailedOps={clearFailedOps}
                canWrite={canWrite}
                nudge={nudge}
                setNudge={setNudge}
                bgTasks={bgTasks}
                bgProcessFiles={bgProcessFiles}
                bgQueueDirectSave={bgQueueDirectSave}
                bgDismissTask={bgDismissTask}
                bgDismissAll={bgDismissAll}
                filtered={filtered}
                sortedTimeline={sortedTimeline}
                availableEntryTypes={availableEntryTypes}
                vaultEntries={dataLayer.vaultEntries}
                loadError={dataLayer.loadError}
              />
            </TooltipProvider>
          </BackgroundOpsProvider>
        </ConceptGraphProvider>
      </BrainContext.Provider>
    </EntriesContext.Provider>
  );
}
