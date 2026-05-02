import { useEffect, useState, useCallback } from "react";
import { authFetch } from "../lib/authFetch";
import { loadPinRecord } from "../lib/vaultPinKey";

// First-run checklist item identifiers — these double as React keys and CTA
// targets. Order matters: it determines render order.
export type ChecklistItemId = "capture5" | "persona" | "gmail" | "calendar" | "vault" | "brain";

export interface ChecklistItem {
  id: ChecklistItemId;
  title: string;
  body: string;
  done: boolean;
  /** What clicking the row should do. Resolved by the consumer. */
  action: ChecklistAction;
}

export type ChecklistAction =
  | { kind: "navigate"; view: string }
  | { kind: "settings"; tab: string }
  | { kind: "openCapture" }
  | { kind: "createBrain" };

export interface FirstRunChecklistState {
  items: ChecklistItem[];
  /** 0..1 — fraction of items complete. */
  progress: number;
  doneCount: number;
  totalCount: number;
  /** True once all items are complete. */
  allDone: boolean;
  /** User has explicitly hidden the card. */
  dismissed: boolean;
  dismiss: () => void;
  undismiss: () => void;
  /** Re-fetch remote state (call after returning from a settings tab). */
  refresh: () => void;
  loading: boolean;
}

const DISMISS_KEY = "everion_home_checklist_dismissed_at";

interface RemoteState {
  personaDone: boolean;
  gmailDone: boolean;
  calendarDone: boolean;
}

async function loadRemote(): Promise<RemoteState> {
  // Persona: any meaningful field filled means "told us about themselves".
  const personaP = authFetch("/api/user-data?resource=persona")
    .then((r) => r?.json?.() ?? null)
    .then((data) => {
      if (!data) return false;
      const p = data?.persona ?? data;
      return Boolean(p?.full_name || p?.preferred_name || p?.context);
    })
    .catch(() => false);

  const gmailP = authFetch("/api/gmail?action=integration")
    .then((r) => r?.json?.() ?? null)
    .then((data) => Boolean(data && (data.id || data.gmail_email)))
    .catch(() => false);

  const calendarP = authFetch("/api/calendar?action=integrations")
    .then((r) => r?.json?.() ?? null)
    .then((data) => {
      const list = Array.isArray(data) ? data : (data?.integrations ?? []);
      return Array.isArray(list) && list.length > 0;
    })
    .catch(() => false);

  const [personaDone, gmailDone, calendarDone] = await Promise.all([personaP, gmailP, calendarP]);
  return { personaDone, gmailDone, calendarDone };
}

interface UseFirstRunChecklistOptions {
  entryCount: number;
  brainCount: number;
}

export function useFirstRunChecklist({
  entryCount,
  brainCount,
}: UseFirstRunChecklistOptions): FirstRunChecklistState {
  const [remote, setRemote] = useState<RemoteState>({
    personaDone: false,
    gmailDone: false,
    calendarDone: false,
  });
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(DISMISS_KEY));
    } catch {
      return false;
    }
  });
  // PIN lives in localStorage; recompute on demand when the user returns from
  // the vault setup flow. We re-read on every refresh() call.
  const [vaultDone, setVaultDone] = useState<boolean>(() => loadPinRecord() !== null);

  const refresh = useCallback(() => {
    setLoading(true);
    setVaultDone(loadPinRecord() !== null);
    void loadRemote()
      .then(setRemote)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only fetch of remote checklist state; refresh() sets loading/vaultDone synchronously then resolves remote async.
    refresh();
  }, [refresh]);

  // Re-check vault status when window regains focus — handles the round-trip
  // through the vault setup flow without needing a manual refresh button.
  useEffect(() => {
    const onFocus = () => {
      setVaultDone(loadPinRecord() !== null);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const undismiss = useCallback(() => {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
    setDismissed(false);
  }, []);

  const items: ChecklistItem[] = [
    {
      id: "capture5",
      title: "Capture 5 things",
      body:
        entryCount >= 5
          ? `${entryCount} thoughts saved.`
          : `${entryCount} of 5 — your brain gets sharper around here.`,
      done: entryCount >= 5,
      action: { kind: "openCapture" },
    },
    {
      id: "persona",
      title: "Tell your brain about you",
      body: "Name, context, habits — answers get noticeably more personal.",
      done: remote.personaDone,
      action: { kind: "settings", tab: "persona" },
    },
    {
      id: "gmail",
      title: "Connect Gmail",
      body: "Continuous inbox capture — the killer feature.",
      done: remote.gmailDone,
      action: { kind: "settings", tab: "connections" },
    },
    {
      id: "calendar",
      title: "Connect Google Calendar",
      body: "Time-aware recall and reminders.",
      done: remote.calendarDone,
      action: { kind: "settings", tab: "connections" },
    },
    {
      id: "vault",
      title: "Set up your vault",
      body: "Encrypted store for IDs, codes, bank details. PIN unlock once you're in.",
      done: vaultDone,
      action: { kind: "navigate", view: "vault" },
    },
    {
      id: "brain",
      title: "Add a second brain",
      body: "Separate work from personal — switch with one tap.",
      done: brainCount > 1,
      action: { kind: "createBrain" },
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const progress = totalCount === 0 ? 0 : doneCount / totalCount;
  const allDone = doneCount === totalCount;

  return {
    items,
    progress,
    doneCount,
    totalCount,
    allDone,
    dismissed,
    dismiss,
    undismiss,
    refresh,
    loading,
  };
}
