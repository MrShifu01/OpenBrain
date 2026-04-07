import type { JSX } from "react";

export default function LoadingScreen(): JSX.Element {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      {/* Ambient background */}
      <div className="synapse-bg" aria-hidden="true" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(114,239,245,0.15) 0%, transparent 70%)",
              filter: "blur(20px)",
              transform: "scale(2)",
            }}
          />
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center border"
            style={{
              background: "rgba(38,38,38,0.7)",
              backdropFilter: "blur(24px)",
              borderColor: "rgba(114,239,245,0.25)",
              boxShadow: "0 0 32px rgba(114,239,245,0.08)",
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#72eff5"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 10px rgba(114,239,245,0.5))" }}
            >
              <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.67 2.84-1.72 3.75A5 5 0 0 1 17 15a5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 1.72-3.75A5 5 0 0 1 7 7a5 5 0 0 1 5-5z" />
              <circle cx="12" cy="12" r="1.5" fill="#72eff5" stroke="none" />
            </svg>
          </div>
        </div>

        {/* Brand */}
        <div className="text-center">
          <h1
            className="font-headline text-2xl font-bold tracking-tight gradient-text"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            OpenBrain
          </h1>
          <p
            className="text-[10px] uppercase tracking-[0.2em] mt-1"
            style={{ color: "#adaaaa" }}
          >
            Neural Interface
          </p>
        </div>

        {/* Loading bar */}
        <div
          className="w-32 h-0.5 rounded-full overflow-hidden"
          style={{ background: "rgba(114,239,245,0.1)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #72eff5, #d575ff)",
              animation: "loading-bar 1.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes loading-bar {
          0%   { width: 0%; margin-left: 0%; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
