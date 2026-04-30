import type { Entry } from "../types";
import { KEYS } from "./storageKeys";

// Local mirror of the entries the user has loaded, used as the offline
// fallback for `entryRepo.list`. Two storage tiers in priority order:
//
//   1. IndexedDB — primary; survives bigger payloads + private-mode quirks.
//   2. localStorage — fallback when IDB is unavailable (Safari ITP eviction,
//      e.g. third-party iframe context).
//
// Per-brain key: callers pass a brainId so brain-switch reads the right
// cache instead of the last-touched brain's. The legacy single-key store
// (`entries_cache.entries`) is preserved as a fallback so users carrying
// over a cache from before this change don't lose their offline list on
// first launch — see CACHE_KEY_LEGACY.

const DB_NAME = "openbrain-cache";
const STORE = "entries_cache";
const DB_VERSION = 1;
const CACHE_KEY_LEGACY = "entries";

interface CacheRecord {
  key: string;
  data: Entry[];
  ts: number;
}

function cacheKey(brainId: string | null | undefined): string {
  return brainId ? `entries:${brainId}` : CACHE_KEY_LEGACY;
}

function lsKey(brainId: string | null | undefined): string {
  return brainId ? KEYS.entriesCacheForBrain(brainId) : KEYS.ENTRIES_CACHE;
}

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function writeEntriesCache(entries: Entry[], brainId?: string | null): Promise<void> {
  try {
    localStorage.setItem(lsKey(brainId), JSON.stringify(entries));
  } catch {
    /* ignore */
  }

  try {
    const db = await openCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        key: cacheKey(brainId),
        data: entries,
        ts: Date.now(),
      } satisfies CacheRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e: unknown) {
    console.warn("[entriesCache] IDB write failed:", e instanceof Error ? e.message : e);
  }
}

export async function readEntriesCache(brainId?: string | null): Promise<Entry[] | null> {
  // Primary: IDB record for the requested brain.
  try {
    const db = await openCacheDB();
    const record = await new Promise<CacheRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(cacheKey(brainId));
      req.onsuccess = () => resolve((req.result as CacheRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (record && Array.isArray(record.data) && record.data.length > 0) {
      return record.data;
    }
  } catch (e: unknown) {
    console.warn(
      "[entriesCache] IDB read failed, falling back to localStorage:",
      e instanceof Error ? e.message : e,
    );
  }

  // Secondary: localStorage for the same brain.
  try {
    const cached = localStorage.getItem(lsKey(brainId));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Entry[];
    }
  } catch {
    /* ignore */
  }

  // Tertiary fallback: legacy single-key cache (pre-per-brain), used only
  // when the per-brain cache is empty so a user carrying over an old install
  // still sees their list on first offline launch after upgrade.
  if (brainId) {
    try {
      const cached = localStorage.getItem(KEYS.ENTRIES_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Entry[];
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}
