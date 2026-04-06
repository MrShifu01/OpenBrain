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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f23] font-['Söhne',system-ui,-apple-system,sans-serif]">
      <div className="mb-4 animate-pulse text-[48px]">🧠</div>
      <div className="h-[3px] w-[120px] overflow-hidden rounded-[3px] bg-[#1a1a2e]">
        <div className="gradient-accent h-full w-[40%] animate-[slide_1.2s_ease-in-out_infinite] rounded-[3px]" />
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
