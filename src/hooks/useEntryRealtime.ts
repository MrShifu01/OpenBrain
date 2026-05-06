// ============================================================
// Lightweight enrichment-progress polling.
// ============================================================
//
// Replaces the previous postgres_changes realtime subscription that was
// responsible for ~65% of total Supabase DB time (the WAL decoder + the
// publication-tables lookup query each time a channel reconnected). The
// publication on `entries` decoded every insert/update/delete for every
// subscriber even though almost no UI surfaces actually consumed those
// updates beyond the enrichment loading dot.
//
// Replacement contract:
//   A 15s setInterval ticks while the active brain is mounted. Each tick
//   bails out early if the document is hidden, or if no entry in the
//   active brain is currently pending enrichment. When at least one
//   entry IS pending and the tab is visible, fetch only those ids
//   (id=in.(...)) and merge enrichment-relevant fields back into local
//   state. Fires an immediate catch-up tick on visibility regain.
//
// Why this is enough:
//   The only consumer of the old realtime stream was the P/I/C/E chips
//   and the wave-dot. Those advance over a 5-30s enrichment window after
//   capture. A 15s poll catches them with at most one stale frame, which
//   matches what users already saw on flaky networks.

import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Entry } from "../types";
import { isPendingEnrichment } from "../lib/enrichFlags";
import { authFetch } from "../lib/authFetch";

const POLL_MS = 15_000;

export function useEntryRealtime(
  activeBrainId: string | undefined,
  setEntries: Dispatch<SetStateAction<Entry[]>>,
): void {
  const setEntriesRef = useRef(setEntries);
  useEffect(() => {
    setEntriesRef.current = setEntries;
  }, [setEntries]);

  useEffect(() => {
    if (!activeBrainId) return;

    let cancelled = false;

    // Snapshot pending ids from current state without actually mutating.
    // The functional setter calls our updater synchronously so we can
    // capture state in a closure and return prev unchanged.
    const snapshotPending = (): string[] => {
      let ids: string[] = [];
      setEntriesRef.current((prev) => {
        ids = prev
          .filter((e) => e.brain_id === activeBrainId && isPendingEnrichment(e))
          .map((e) => e.id);
        return prev;
      });
      return ids;
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      const pending = snapshotPending();
      if (pending.length === 0) return;
      try {
        const idList = pending.slice(0, 100).join(",");
        const r = await authFetch(`/api/entries?ids=${encodeURIComponent(idList)}`, {
          cache: "no-store",
        });
        if (!r?.ok) return;
        const data = await r.json().catch(() => null);
        const rows: Entry[] = Array.isArray(data) ? data : (data?.entries ?? []);
        if (!rows.length || cancelled) return;
        setEntriesRef.current((prev) => {
          const byId = new Map(rows.map((row) => [row.id, row]));
          let dirty = false;
          const next = prev.map((e) => {
            const fresh = byId.get(e.id);
            if (!fresh) return e;
            // Merge only fields enrichment flips — leaves any in-flight
            // optimistic edits to title / tags / content untouched.
            const merged: Entry = {
              ...e,
              metadata: fresh.metadata ?? e.metadata,
              embedded_at: fresh.embedded_at ?? e.embedded_at,
              embedding_status: fresh.embedding_status ?? e.embedding_status,
              status: fresh.status ?? e.status,
            };
            dirty = true;
            return merged;
          });
          return dirty ? next : prev;
        });
      } catch {
        // Network blip — next tick retries. Don't surface to the UI.
      }
    };

    const id = setInterval(tick, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeBrainId]);
}
