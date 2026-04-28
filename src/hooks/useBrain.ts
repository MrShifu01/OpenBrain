import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../lib/authFetch";
import type { Brain } from "../types";

const ACTIVE_KEY = "openbrain_active_brain_id";

export function useBrain(onBrainSwitch?: (brain: Brain | null) => void) {
  const [brains, setBrains] = useState<Brain[]>([]);
  const [activeBrain, setActiveBrainState] = useState<Brain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrains = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/brains");
      if (!res.ok) throw new Error("Failed to load brains");
      const data: Brain[] = await res.json();
      setBrains(data);

      // Resolution order for active brain:
      //   1. Server-persisted active_brain_id (cross-device, X-Active-Brain-Id header)
      //   2. localStorage cached id (instant offline render)
      //   3. Personal brain (is_personal=true)
      //   4. First brain in list
      const serverActive = res.headers.get("X-Active-Brain-Id");
      let cachedId: string | null = null;
      try {
        cachedId = localStorage.getItem(ACTIVE_KEY);
      } catch {
        /* private mode, etc. */
      }
      const personal = data.find((b) => b.is_personal) ?? null;
      const fallback = personal ?? data[0] ?? null;
      const resolved =
        (serverActive && data.find((b) => b.id === serverActive)) ||
        (cachedId && data.find((b) => b.id === cachedId)) ||
        fallback;

      setActiveBrainState((prev) => {
        // If we already had an active brain and it still exists, keep it.
        if (prev && data.find((b) => b.id === prev.id)) return prev;
        return resolved;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrains();
  }, [fetchBrains]);

  const setActiveBrain = useCallback(
    (brain: Brain | null) => {
      setActiveBrainState(brain);
      try {
        if (brain?.id) localStorage.setItem(ACTIVE_KEY, brain.id);
        else localStorage.removeItem(ACTIVE_KEY);
      } catch {
        /* ignore */
      }
      if (onBrainSwitch) onBrainSwitch(brain);
    },
    [onBrainSwitch],
  );

  return {
    brains,
    activeBrain,
    setActiveBrain,
    loading,
    error,
    refresh: fetchBrains,
  };
}
