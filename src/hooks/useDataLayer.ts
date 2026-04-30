import { useState, useEffect, useCallback, useRef } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { authFetch } from "../lib/authFetch";
import { entryRepo } from "../lib/entryRepo";
import { readEntriesCache, writeEntriesCache } from "../lib/entriesCache";
import { readVaultEntriesCache, writeVaultEntriesCache } from "../lib/vaultEntriesCache";
import { decryptEntry, cacheVaultKey } from "../lib/crypto";
import { indexEntry } from "../lib/searchIndex";
import { LINKS } from "../data/constants";
import { useEntryActions } from "./useEntryActions";
import type { Entry, Link } from "../types";

interface UseDataLayerParams {
  activeBrainId?: string;
  setSelected: Dispatch<SetStateAction<Entry | null>>;
  isOnline: boolean;
  isOnlineRef: RefObject<boolean>;
  refreshCount: () => void;
}

export function useDataLayer({
  activeBrainId,
  setSelected,
  isOnline,
  isOnlineRef,
  refreshCount,
}: UseDataLayerParams) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const cached = localStorage.getItem("openbrain_entries");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.every((e) => e && typeof e.id === "string"))
          return parsed;
      }
    } catch (err) {
      console.error("[OpenBrain]", err);
    }
    return [];
  });
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [links, setLinks] = useState<Link[]>(LINKS);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultEntries, setVaultEntries] = useState<Entry[]>([]);
  const vaultEntryIdsRef = useRef<Set<string>>(new Set());

  // Load entries cache on mount — read the per-brain cache for the active brain
  // first, falling back to the legacy single-key cache. Empty cache leaves the
  // existing list intact (could be hydrated from the synchronous localStorage
  // bootstrap above).
  useEffect(() => {
    readEntriesCache(activeBrainId)
      .then((cached) => {
        if (cached && cached.length > 0) setEntries((prev) => (prev.length === 0 ? cached : prev));
      })
      .catch((err) => console.error("[OpenBrain] readEntriesCache failed", err));
    // activeBrainId in deps so the cache load re-runs if the brain changes
    // before the network refresh can fill in.
  }, [activeBrainId]);

  // Vault existence check
  useEffect(() => {
    authFetch("/api/vault")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.exists) setVaultExists(true);
      })
      .catch((err) => console.error("[OpenBrain] /api/vault check failed", err));
  }, []);

  // Fetch vault entries for the memory feed (titles are plaintext; content
  // stays encrypted). Cache is read first so the vault tab works offline —
  // the cached blob is the same AES-GCM ciphertext the server returns, so
  // local storage doesn't widen the trust boundary. Reconnect overwrites
  // with the latest server view.
  const fetchVaultEntries = useCallback(async () => {
    // Cache first — non-blocking, gives offline users immediate vault content.
    readVaultEntriesCache()
      .then((cached) => {
        if (cached && cached.length > 0) {
          vaultEntryIdsRef.current = new Set(cached.map((e) => e.id));
          setVaultEntries((prev) => (prev.length === 0 ? cached : prev));
        }
      })
      .catch(() => {});

    try {
      const r = await authFetch("/api/vault-entries");
      if (!r.ok) return;
      const data: Partial<Entry>[] = await r.json();
      const fetched: Entry[] = data.map((e) => ({
        ...e,
        type: "secret" as const,
        encrypted: true,
      })) as Entry[];
      vaultEntryIdsRef.current = new Set(fetched.map((e) => e.id));
      setVaultEntries(fetched);
      // Persist for the next offline boot.
      writeVaultEntriesCache(fetched).catch(() => {});
    } catch (e) {
      console.debug("[useDataLayer] fetchVaultEntries failed", e);
    }
  }, []);

  useEffect(() => {
    fetchVaultEntries();
  }, [fetchVaultEntries]);

  const refreshEntries = useCallback(async () => {
    if (!activeBrainId) return;
    setEntriesLoaded(false);
    setLoadError(null);
    // Fire phase 1 (fast 20-row first-paint) and phase 2 (full 1000-row
    // background) concurrently so phase 2 isn't gated on phase 1's
    // round-trip. PostgREST can't stream, so we still want both — phase 1
    // returns first (smaller payload) and unblocks the UI while phase 2
    // continues in the background. Net cold-load saving ~100-200 ms.
    const phase1 = entryRepo.list({
      brainId: activeBrainId,
      limit: 20,
      onError: (status, body) => {
        setLoadError(`HTTP ${status}${body ? `: ${body.slice(0, 200)}` : ""}`);
      },
    });
    // Phase 2 walks every page until the server says hasMore=false. Replaces
    // the previous unbounded `limit: 1000` fetch — handles brains that have
    // grown past 1000 entries and paginates cleanly under a 5000-entry cap
    // (LIST_ALL_HARD_CAP in entryRepo). Same network shape, just cursor-paged.
    const phase2 = entryRepo.listAll({ brainId: activeBrainId });

    try {
      const initial = await phase1;
      if (initial.length > 0) {
        setEntries(initial);
        initial.filter((e) => e.type !== "secret").forEach(indexEntry);
      }
    } finally {
      setEntriesLoaded(true); // unblock UI regardless of phase 1 outcome
    }

    phase2
      .then((all) => {
        if (all.length > 0) {
          setEntries(all);
          writeEntriesCache(all, activeBrainId);
          all.filter((e) => e.type !== "secret").forEach(indexEntry);
        }
      })
      .catch(() => {});
  }, [activeBrainId]);

  // Fetch entries + prefetch links when brain changes.
  // prevBrainIdRef guards against clearing entries on initial mount
  // (which would flash-blank the cached list before the API returns).
  // On brain switch we hydrate from the new brain's cache synchronously
  // (best-effort) before kicking off the network refresh — keeps the user
  // looking at the right brain's entries even when offline.
  const prevBrainIdRef = useRef(activeBrainId);
  useEffect(() => {
    if (!activeBrainId) return;
    if (prevBrainIdRef.current !== activeBrainId) {
      // Hydrate from cache if the new brain has one — replaces the unconditional
      // setEntries([]) which used to flash blank for offline users.
      readEntriesCache(activeBrainId)
        .then((cached) => {
          setEntries(cached && cached.length > 0 ? cached : []);
        })
        .catch(() => setEntries([]));
      setLinks([]);
      prevBrainIdRef.current = activeBrainId;
    }
    refreshEntries();
    authFetch(`/api/search?brain_id=${encodeURIComponent(activeBrainId)}&threshold=0.55`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const arr = Array.isArray(data) ? data : data.links || [];
        if (arr.length > 0) setLinks(arr);
      })
      .catch((err) => console.error("[OpenBrain] /api/search prefetch failed", err));
  }, [activeBrainId, refreshEntries]);

  // Write-back cache after entries settle — keyed on the active brain so a
  // brain switch can read the right cache later.
  useEffect(() => {
    if (!entriesLoaded) return;
    const t = setTimeout(() => writeEntriesCache(entries, activeBrainId), 3000);
    return () => clearTimeout(t);
  }, [entries, entriesLoaded, activeBrainId]);

  const handleVaultUnlock = useCallback((key: CryptoKey | null) => {
    setCryptoKey(key);
    if (key) {
      cacheVaultKey(key).catch(() => {});
      // Only decrypt legacy secrets in entries table; vault_entries stay PIN-gated
      const vaultIds = vaultEntryIdsRef.current;
      setEntries((prev) => {
        Promise.all(
          prev.map((e) => (e.type === "secret" && !vaultIds.has(e.id) ? decryptEntry(e, key!) : e)),
        ).then((decrypted) => setEntries(decrypted as Entry[]));
        return prev;
      });
    }
  }, []);

  const {
    lastAction,
    setLastAction,
    saveError,
    setSaveError,
    commitPendingDelete,
    handleDelete,
    handleUpdate: _handleUpdateBase,
    handleUndo,
    handleCreated: _handleCreated,
  } = useEntryActions({
    entries,
    setEntries,
    setSelected,
    isOnline,
    isOnlineRef,
    refreshCount,
    cryptoKey,
    activeBrainId,
  });

  // Flush pending delete on page hide / unload
  useEffect(() => {
    const flush = () => commitPendingDelete();
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [commitPendingDelete]);

  // silentUpdate uses the base updater so enrichEntry's own flag writes don't re-trigger enrichment
  const silentUpdate = useCallback(
    (id: string, changes: Partial<Entry>) => _handleUpdateBase(id, changes, { silent: true }),
    [_handleUpdateBase],
  );

  const handleUpdate = useCallback(
    async (id: string, changes: Partial<Entry>, options?: { silent?: boolean }) => {
      await _handleUpdateBase(id, changes, options);
    },
    [_handleUpdateBase],
  );

  /** Stable callback for useOfflineSync onEntryIdUpdate. */
  const patchEntryId = useCallback((tempId: string, realId: string) => {
    setEntries((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: realId } : e)));
  }, []);

  const addLinks = useCallback(
    (newLinks: Link[]) => setLinks((prev) => [...prev, ...newLinks]),
    [],
  );

  const handleCreated = useCallback(
    (newEntry: Entry) => {
      _handleCreated(newEntry);
    },
    [_handleCreated],
  );

  return {
    entries,
    vaultEntries,
    setEntries,
    entriesLoaded,
    loadError,
    refreshEntries,
    links,
    setLinks,
    addLinks,
    cryptoKey,
    handleVaultUnlock,
    vaultExists,
    patchEntryId,
    handleCreated,
    handleCreatedBulk: handleCreated,
    lastAction,
    setLastAction,
    saveError,
    setSaveError,
    handleDelete,
    handleUpdate,
    handleUndo,
    commitPendingDelete,
    silentUpdate,
  };
}
