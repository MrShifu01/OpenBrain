import { useState, useEffect, type JSX } from "react";
import { supabase } from "./lib/supabase";
import OpenBrain from "./OpenBrain";
import LoginScreen from "./LoginScreen";
import ErrorBoundary from "./ErrorBoundary";
import { MemoryProvider } from "./MemoryContext";
import type { Session } from "@supabase/supabase-js";

/**
 * Parse Supabase auth tokens from URL hash.
 * Magic links redirect to: origin/#access_token=...&refresh_token=...
 */
function getHashTokens(): { access_token: string; refresh_token: string } | null {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (access_token && refresh_token) return { access_token, refresh_token };
  return null;
}

function LoadingScreen(): JSX.Element {
  return (
    <div>
      {/* Synapse logo */}
      <div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#72eff5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.67 2.84-1.72 3.75A5 5 0 0 1 17 15a5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 1.72-3.75A5 5 0 0 1 7 7a5 5 0 0 1 5-5z"/>
          <circle cx="12" cy="12" r="1.5" fill="#72eff5" stroke="none"/>
        </svg>
      </div>
      {/* Brand */}
      <p>OpenBrain</p>
      {/* Loading bar */}
      <div>
        <div />
      </div>
      <style>{`
        @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
      `}</style>
    </div>
  );
}

export default function App(): JSX.Element {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // If magic link tokens are in the URL hash, establish session from them
    const tokens = getHashTokens();
    if (tokens) {
      supabase.auth.setSession(tokens).then(({ data: { session } }) => {
        setSession(session);
        window.history.replaceState(null, "", window.location.pathname);
      });
      return;
    }

    // Normal startup — check existing session
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  return (
    <ErrorBoundary>
      <MemoryProvider>
        <OpenBrain />
      </MemoryProvider>
    </ErrorBoundary>
  );
}
