import type { Entry } from "../types";

// Mirror of the encrypted vault rows fetched from /api/vault-entries so the
// vault tab can render + decrypt offline. Entries are stored exactly as the
// API returns them — already AES-GCM encrypted with a passphrase-derived key
// the server can't read, so the local copy isn't more sensitive than the
// remote one. Same IDB approach as entriesCache.ts (with a localStorage
// fallback for Safari ITP / private mode).

const DB_NAME = "openbrain-cache";
const STORE = "vault_entries_cache";
const DB_VERSION = 1;
const CACHE_KEY = "vault_entries";
const LS_KEY = "openbrain_vault_entries_cache";

interface CacheRecord {
  key: string;
  data: Entry[];
  ts: number;
}

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // entriesCache.ts already creates `entries_cache`; if the DB exists with
    // version 1 we need to add this store via an upgrade. Bump DB_VERSION on
    // both files together would race; instead we tolerate missing store and
    // fall through to localStorage.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function writeVaultEntriesCache(entries: Entry[]): Promise<void> {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
  try {
    const db = await openCacheDB();
    if (!db.objectStoreNames.contains(STORE)) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        key: CACHE_KEY,
        data: entries,
        ts: Date.now(),
      } satisfies CacheRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e: unknown) {
    console.warn("[vaultEntriesCache] IDB write failed:", e instanceof Error ? e.message : e);
  }
}

export async function readVaultEntriesCache(): Promise<Entry[] | null> {
  try {
    const db = await openCacheDB();
    if (db.objectStoreNames.contains(STORE)) {
      const record = await new Promise<CacheRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(CACHE_KEY);
        req.onsuccess = () => resolve((req.result as CacheRecord) ?? null);
        req.onerror = () => reject(req.error);
      });
      if (record && Array.isArray(record.data) && record.data.length > 0) {
        return record.data;
      }
    }
  } catch (e: unknown) {
    console.warn(
      "[vaultEntriesCache] IDB read failed, falling back to localStorage:",
      e instanceof Error ? e.message : e,
    );
  }
  try {
    const cached = localStorage.getItem(LS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Entry[];
    }
  } catch {
    /* ignore */
  }
  return null;
}
