// Stale-while-revalidate query hook backed by an in-memory map +
// sessionStorage. Built to take pressure off Supabase / Vercel Functions
// when settings tabs (lazy-loaded) keep refetching the same data on every
// mount. The DB unhealthy alerts in 2026-05 were traced to: AdminTab 30s
// poll with no document.hidden gate, and every settings tab re-firing
// integration probes on every tab switch.
//
// Semantics:
//   - Returns cached data immediately on mount (no flash).
//   - Refetches in the background if the cache is older than ttlMs.
//   - Pauses background revalidation when the document is hidden.
//   - Revalidates once when the document becomes visible again, but only
//     if data is stale (cheap no-op if fresh).
//   - In-flight requests are deduped per key so concurrent mounts of the
//     same surface share one network call.
//
// Cache key choice: use a stable string the consumer constructs. For
// per-brain / per-user surfaces, embed the discriminator in the key
// (e.g. `brain-members:${brainId}`). The hook treats `null` as "wait —
// don't fetch yet" so callers can gate on async dependencies.

import { useEffect, useState, useRef, useCallback } from "react";

interface CacheEntry<T = unknown> {
  data: T;
  ts: number;
}

const memCache: Map<string, CacheEntry> = new Map();
const inflight: Map<string, Promise<unknown>> = new Map();
const STORAGE_PREFIX = "everion:cq:";

function readStorage<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (typeof parsed?.ts !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: CacheEntry<T>): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // QuotaExceeded / private mode — fine, in-memory cache still works.
  }
}

function readCache<T>(key: string): CacheEntry<T> | null {
  const mem = memCache.get(key);
  if (mem) return mem as CacheEntry<T>;
  const stored = readStorage<T>(key);
  if (stored) {
    memCache.set(key, stored);
    return stored;
  }
  return null;
}

function writeCache<T>(key: string, data: T): CacheEntry<T> {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  memCache.set(key, entry);
  writeStorage(key, entry);
  return entry;
}

export interface UseCachedQueryOptions {
  /** TTL in ms after which background revalidation fires. Default 5 min. */
  ttlMs?: number;
  /** When false, no fetch fires (use to gate on async deps). Default true. */
  enabled?: boolean;
  /** Revalidate when the document regains visibility. Default true. */
  revalidateOnFocus?: boolean;
}

export interface CachedQueryResult<T> {
  data: T | null;
  /** True only on the very first load when there's no cache. */
  isLoading: boolean;
  /** True when a background revalidation is in-flight (cache is showing). */
  isValidating: boolean;
  error: Error | null;
  /** Force refetch + cache write. */
  refetch: () => Promise<T | null>;
  /** Optimistically write a value into cache without refetching. */
  mutate: (data: T | null) => void;
}

export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts: UseCachedQueryOptions = {},
): CachedQueryResult<T> {
  const { ttlMs = 5 * 60_000, enabled = true, revalidateOnFocus = true } = opts;

  const [data, setData] = useState<T | null>(() => {
    if (!key) return null;
    return (readCache<T>(key)?.data as T | undefined) ?? null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const doFetch = useCallback(
    async (showLoading: boolean): Promise<T | null> => {
      if (!key) return null;
      const existing = inflight.get(key) as Promise<T> | undefined;
      if (existing) {
        try {
          const res = await existing;
          if (mountedRef.current) setData(res);
          return res;
        } catch (e) {
          if (mountedRef.current) {
            setError(e instanceof Error ? e : new Error(String(e)));
          }
          return null;
        }
      }
      if (showLoading) setIsLoading(true);
      setIsValidating(true);
      setError(null);
      const promise = fetcherRef.current();
      inflight.set(key, promise as Promise<unknown>);
      try {
        const res = await promise;
        writeCache(key, res);
        if (mountedRef.current) {
          setData(res);
          setError(null);
        }
        return res;
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
        return null;
      } finally {
        inflight.delete(key);
        if (mountedRef.current) {
          setIsLoading(false);
          setIsValidating(false);
        }
      }
    },
    [key],
  );

  // Initial mount + key change. Hydrate from cache first; revalidate only
  // if the cache is stale or absent.
  useEffect(() => {
    if (!key || !enabled) return;
    const cached = readCache<T>(key);
    if (cached) {
      setData(cached.data);
      if (Date.now() - cached.ts > ttlMs) void doFetch(false);
    } else {
      void doFetch(true);
    }
  }, [key, enabled, ttlMs, doFetch]);

  // Visibility-gated revalidation. Skips if data is fresh, so the typical
  // tab-focus is a free no-op.
  useEffect(() => {
    if (!revalidateOnFocus || !key || !enabled) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const cached = readCache<T>(key);
      if (!cached || Date.now() - cached.ts > ttlMs) void doFetch(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [key, enabled, ttlMs, doFetch, revalidateOnFocus]);

  const refetch = useCallback(() => doFetch(false), [doFetch]);

  const mutate = useCallback(
    (next: T | null) => {
      setData(next);
      if (!key) return;
      if (next === null) {
        memCache.delete(key);
        try {
          sessionStorage.removeItem(STORAGE_PREFIX + key);
        } catch {
          /* ignore */
        }
      } else {
        writeCache(key, next);
      }
    },
    [key],
  );

  return { data, isLoading, isValidating, error, refetch, mutate };
}

/** Drop a single key from cache + storage. Use after a mutation. */
export function invalidateCachedQuery(key: string): void {
  memCache.delete(key);
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Drop every key starting with a prefix. Useful for "all per-brain caches." */
export function invalidateCachedQueriesMatching(prefix: string): void {
  for (const k of Array.from(memCache.keys())) {
    if (k.startsWith(prefix)) memCache.delete(k);
  }
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX + prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
