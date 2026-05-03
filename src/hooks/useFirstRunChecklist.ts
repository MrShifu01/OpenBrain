import { useEffect, useState, useCallback, useRef } from "react";
import { authFetch } from "../lib/authFetch";

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

// Server-side sticky-done flags. Once an item is observed as done — by a
// live remote check or an in-memory threshold — we POST it here so the row
// persists across devices and survives API blips. Schema: one row per
// (user_id, item_id) in user_checklist_done.
type DoneFlags = Partial<Record<ChecklistItemId, string>>;

interface RemoteState {
  personaDone: boolean;
  gmailDone: boolean;
  calendarDone: boolean;
  vaultDone: boolean;
}

async function loadRemote(): Promise<RemoteState> {
  // Persona lives at /api/user-data?resource=profile (handler reads
  // user_personas table but the resource key is "profile"). Response shape:
  // { profile: row | null }. Any of full_name / preferred_name / context
  // being non-empty counts as "told us about themselves".
  const personaP = authFetch("/api/user-data?resource=profile")
    .then((r) => r?.json?.() ?? null)
    .then((data) => {
      const p = data?.profile;
      if (!p) return false;
      return Boolean(p.full_name || p.preferred_name || p.context);
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

  // Vault: server-side check for any encrypted entry. PIN lives in
  // localStorage and so doesn't survive a fresh device — counting
  // vault_entries rows is the only cross-device-accurate signal.
  const vaultP = authFetch("/api/user-data?resource=vault_entries")
    .then((r) => r?.json?.() ?? null)
    .then((data) => {
      const list = Array.isArray(data) ? data : (data?.entries ?? data?.vault_entries ?? []);
      return Array.isArray(list) && list.length > 0;
    })
    .catch(() => false);

  const [personaDone, gmailDone, calendarDone, vaultDone] = await Promise.all([
    personaP,
    gmailP,
    calendarP,
    vaultP,
  ]);
  return { personaDone, gmailDone, calendarDone, vaultDone };
}

async function loadDoneFlags(): Promise<DoneFlags> {
  try {
    const r = await authFetch("/api/user-data?resource=checklist_done");
    if (!r?.ok) return {};
    const data = await r.json();
    const items = (data?.items ?? {}) as Record<string, string>;
    return items as DoneFlags;
  } catch {
    return {};
  }
}

async function pinDoneRemote(id: ChecklistItemId): Promise<void> {
  try {
    await authFetch("/api/user-data?resource=checklist_done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: id }),
    });
  } catch {
    /* best-effort — local optimistic state already shows it as done */
  }
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
    vaultDone: false,
  });
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(DISMISS_KEY));
    } catch {
      return false;
    }
  });
  const [doneFlags, setDoneFlags] = useState<DoneFlags>({});
  // In-flight pin requests so we don't hammer the server with the same id
  // every render while threshold conditions stay true.
  const pinningRef = useRef<Set<ChecklistItemId>>(new Set());

  const pinIfNew = useCallback((id: ChecklistItemId) => {
    setDoneFlags((prev) => {
      if (prev[id]) return prev;
      if (pinningRef.current.has(id)) return prev;
      pinningRef.current.add(id);
      void pinDoneRemote(id).finally(() => pinningRef.current.delete(id));
      return { ...prev, [id]: new Date().toISOString() };
    });
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    void Promise.all([loadRemote(), loadDoneFlags()])
      .then(([next, serverFlags]) => {
        setRemote(next);
        setDoneFlags((prev) => {
          // Merge: server flags are authoritative for the cross-device baseline,
          // but keep any optimistic local pins from this session.
          const merged: DoneFlags = { ...prev, ...serverFlags };
          // Pin anything the live check just confirmed if it's not already
          // on the server.
          if (next.personaDone && !merged.persona) pinIfNew("persona");
          if (next.gmailDone && !merged.gmail) pinIfNew("gmail");
          if (next.calendarDone && !merged.calendar) pinIfNew("calendar");
          if (next.vaultDone && !merged.vault) pinIfNew("vault");
          return merged;
        });
      })
      .finally(() => setLoading(false));
  }, [pinIfNew]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only fetch of remote checklist state.
    refresh();
  }, [refresh]);

  // Re-fetch when the window regains focus — handles round-trips through
  // settings tabs and the vault setup flow without needing a manual refresh.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Pin in-memory-derived items as soon as they go true so they stay done
  // even if entries get deleted later or brains get pruned.
  useEffect(() => {
    if (entryCount >= 5) pinIfNew("capture5");
    if (brainCount > 1) pinIfNew("brain");
  }, [entryCount, brainCount, pinIfNew]);

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

  // Helper: an item is done if EITHER the live signal says so OR we've
  // ever pinned it server-side. One-and-done semantics — no flicker.
  const stickyDone = (id: ChecklistItemId, live: boolean): boolean =>
    Boolean(live || doneFlags[id]);

  const items: ChecklistItem[] = [
    {
      id: "capture5",
      title: "Capture 5 things",
      body:
        entryCount >= 5
          ? `${entryCount} thoughts saved.`
          : `${entryCount} of 5 — your brain gets sharper around here.`,
      done: stickyDone("capture5", entryCount >= 5),
      action: { kind: "openCapture" },
    },
    {
      id: "persona",
      title: "Tell your brain about you",
      body: "Name, context, habits — answers get noticeably more personal.",
      done: stickyDone("persona", remote.personaDone),
      action: { kind: "settings", tab: "persona" },
    },
    {
      id: "gmail",
      title: "Connect Gmail",
      body: "Continuous inbox capture — the killer feature.",
      done: stickyDone("gmail", remote.gmailDone),
      action: { kind: "settings", tab: "connections" },
    },
    {
      id: "calendar",
      title: "Connect Google Calendar",
      body: "Time-aware recall and reminders.",
      done: stickyDone("calendar", remote.calendarDone),
      action: { kind: "settings", tab: "connections" },
    },
    {
      id: "vault",
      title: "Set up your vault",
      body: "Encrypted store for IDs, codes, bank details. Add your first secret to mark this done.",
      done: stickyDone("vault", remote.vaultDone),
      action: { kind: "navigate", view: "vault" },
    },
    {
      id: "brain",
      title: "Add a second brain",
      body: "Separate work from personal — switch with one tap.",
      done: stickyDone("brain", brainCount > 1),
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
