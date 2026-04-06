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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0e0e0e] font-['Inter',system-ui,-apple-system,sans-serif]">
      {/* Atmospheric background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 40%, rgba(114,239,245,0.07) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(139,92,246,0.07) 0%, transparent 50%)",
        }}
      />
      {/* Synapse logo */}
      <div className="relative mb-8">
        <div
          className="absolute -inset-6 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(114,239,245,0.15), transparent 70%)" }}
        />
        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-full border"
          style={{
            background: "rgba(38,38,38,0.6)",
            backdropFilter: "blur(24px)",
            borderColor: "rgba(114,239,245,0.2)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#72eff5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.67 2.84-1.72 3.75A5 5 0 0 1 17 15a5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 1.72-3.75A5 5 0 0 1 7 7a5 5 0 0 1 5-5z"/>
            <circle cx="12" cy="12" r="1.5" fill="#72eff5" stroke="none"/>
          </svg>
          <div
            className="absolute inset-0 rounded-full border animate-pulse"
            style={{ borderColor: "rgba(114,239,245,0.15)", transform: "scale(1.2)" }}
          />
        </div>
      </div>
      {/* Brand */}
      <p
        className="mb-6 font-['Manrope',sans-serif] text-lg font-semibold tracking-widest uppercase"
        style={{ color: "#adaaaa", letterSpacing: "0.2em" }}
      >
        OpenBrain
      </p>
      {/* Loading bar */}
      <div className="h-[2px] w-[120px] overflow-hidden rounded-full bg-[#262626]">
        <div
          className="h-full w-[40%] rounded-full animate-[slide_1.2s_ease-in-out_infinite]"
          style={{ background: "linear-gradient(90deg, #72eff5, #8b5cf6)" }}
        />
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
