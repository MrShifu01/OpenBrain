import { useEffect, useState } from "react";
import { authFetch } from "../lib/authFetch";

export interface HomePersona {
  loaded: boolean;
  /** Display name — preferred_name first, falls back to first word of full_name. */
  name: string | null;
}

export function useHomePersona(): HomePersona {
  const [state, setState] = useState<HomePersona>({ loaded: false, name: null });

  useEffect(() => {
    let cancelled = false;
    void authFetch("/api/user-data?resource=persona")
      .then((r) => r?.json?.())
      .then((data) => {
        if (cancelled) return;
        const p = (data?.persona ?? data) as
          | { full_name?: string; preferred_name?: string }
          | null
          | undefined;
        const preferred = p?.preferred_name?.trim();
        const full = p?.full_name?.trim();
        const name = preferred || full?.split(/\s+/)[0] || null;
        setState({ loaded: true, name });
      })
      .catch(() => {
        if (!cancelled) setState({ loaded: true, name: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
