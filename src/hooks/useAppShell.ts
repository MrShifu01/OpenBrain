import { useState, useEffect, useCallback } from "react";
import { getTypeIcons } from "../lib/typeIcons";
import { supabase } from "../lib/supabase";
import type { Entry, Brain } from "../types";
import type { EntryFilterState } from "../lib/entryFilters";

interface UseAppShellOptions {
  initialShowCapture?: boolean;
  activeBrainId?: string;
}

export interface AppShellState {
  // Navigation
  view: string;
  setView: React.Dispatch<React.SetStateAction<string>>;
  selected: Entry | null;
  setSelected: React.Dispatch<React.SetStateAction<Entry | null>>;
  // Modals
  showCapture: boolean;
  setShowCapture: React.Dispatch<React.SetStateAction<boolean>>;
  captureInitialText: string;
  openCapture: (initialText?: string) => void;
  showOnboarding: boolean;
  setShowOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
  showBrainTip: Brain | null;
  setShowBrainTip: React.Dispatch<React.SetStateAction<Brain | null>>;
  showCreateBrain: boolean;
  setShowCreateBrain: React.Dispatch<React.SetStateAction<boolean>>;
  // Search & filter
  searchInput: string;
  setSearchInput: React.Dispatch<React.SetStateAction<string>>;
  search: string;
  workspace: string;
  gridFilters: EntryFilterState;
  setGridFilters: React.Dispatch<React.SetStateAction<EntryFilterState>>;
  gridViewMode: "grid" | "list";
  setGridViewMode: React.Dispatch<React.SetStateAction<"grid" | "list">>;
  // Selection
  selectMode: boolean;
  toggleSelectMode: () => void;
  selectedIds: Set<string>;
  toggleSelectId: (id: string) => void;
  // Type icons
  typeIcons: Record<string, string>;
  refreshTypeIcons: () => void;
}

export function useAppShell({
  initialShowCapture,
  activeBrainId,
}: UseAppShellOptions = {}): AppShellState {
  // Navigation
  const [view, setView] = useState("memory");
  const [selected, setSelected] = useState<Entry | null>(null);

  // Modals
  const [showCapture, setShowCapture] = useState(!!initialShowCapture);
  const [captureInitialText, setCaptureInitialText] = useState("");
  // Onboarding gate. localStorage is the fast path (avoids modal flash on
  // returning visitors); a follow-up DB check covers cross-device users whose
  // local store doesn't yet know they're onboarded. Old key
  // `openbrain_onboarded` is honored for back-compat — when seen, we migrate
  // it forward to the new key.
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const newKey = localStorage.getItem("everion_onboarded");
    if (newKey) return false;
    const oldKey = localStorage.getItem("openbrain_onboarded");
    if (oldKey) {
      localStorage.setItem("everion_onboarded", "1");
      localStorage.removeItem("openbrain_onboarded");
      return false;
    }
    return true;
  });
  const [showBrainTip, setShowBrainTip] = useState<Brain | null>(null);
  const [showCreateBrain, setShowCreateBrain] = useState(false);

  // Search & filter
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [workspace] = useState(() => localStorage.getItem("openbrain_workspace") || "all");
  const [gridFilters, setGridFilters] = useState<EntryFilterState>({
    type: "all",
    date: "all",
    sort: "newest",
  });
  const [gridViewMode, setGridViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("openbrain_viewmode") as "grid" | "list") || "grid",
  );

  // Selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Type icons
  const [typeIcons, setTypeIcons] = useState<Record<string, string>>({});

  // Drain any text captured before auth completed
  useEffect(() => {
    const pending = localStorage.getItem("ob_pending_capture");
    if (pending) {
      localStorage.removeItem("ob_pending_capture");
      setCaptureInitialText(pending);
      setShowCapture(true);
    }
  }, []);

  // Restart-onboarding event
  useEffect(() => {
    const h = () => setShowOnboarding(true);
    window.addEventListener("openbrain:restart-onboarding", h);
    return () => window.removeEventListener("openbrain:restart-onboarding", h);
  }, []);

  // Cross-device onboarding sync. If localStorage thinks we still need
  // onboarding, double-check with user_profiles.onboarded_at — a user signed
  // in on a new device shouldn't be re-onboarded just because their local
  // store is empty. One-shot: only fires while we believe onboarding is
  // pending.
  useEffect(() => {
    if (!showOnboarding) return;
    let cancelled = false;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled || !userData?.user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("onboarded_at")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.onboarded_at) {
        try {
          localStorage.setItem("everion_onboarded", "1");
        } catch {
          /* ignore */
        }
        setShowOnboarding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showOnboarding]);

  // Cmd+K is handled by OmniSearch — do not open CaptureSheet here.

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Sync type icons when brain changes
  useEffect(() => {
    if (activeBrainId) setTypeIcons(getTypeIcons(activeBrainId));
  }, [activeBrainId]);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const refreshTypeIcons = useCallback(() => {
    if (activeBrainId) setTypeIcons(getTypeIcons(activeBrainId));
  }, [activeBrainId]);

  const openCapture = useCallback((initialText = "") => {
    setCaptureInitialText(initialText);
    setShowCapture(true);
  }, []);

  return {
    view,
    setView,
    selected,
    setSelected,
    showCapture,
    setShowCapture,
    captureInitialText,
    openCapture,
    showOnboarding,
    setShowOnboarding,
    showBrainTip,
    setShowBrainTip,
    showCreateBrain,
    setShowCreateBrain,
    searchInput,
    setSearchInput,
    search,
    workspace,
    gridFilters,
    setGridFilters,
    gridViewMode,
    setGridViewMode,
    selectMode,
    toggleSelectMode,
    selectedIds,
    toggleSelectId,
    typeIcons,
    refreshTypeIcons,
  };
}
