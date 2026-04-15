import type { JSX } from "react";

export default function LoadingScreen(): JSX.Element {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: "var(--color-background)" }}
    >
      <div className="flex flex-col items-center gap-10">
        {/* Brand — editorial, nothing else */}
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "'Lora', Georgia, serif", color: "var(--color-on-surface)" }}
        >
          EverionMind
        </h1>

        {/* Loading bar — transform-only, ease-out-expo */}
        <div
          className="h-px w-28 overflow-hidden rounded-full"
          style={{ background: "var(--color-outline-variant)" }}
        >
          <div
            className="h-full w-1/2 rounded-full"
            style={{
              background: "var(--color-primary)",
              animation: "loading-sweep 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}
