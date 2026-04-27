// Compact in-place error fallback for view-scoped ErrorBoundary. Used when
// a single view (chat, vault, capture welcome) crashes — we keep the shell
// alive instead of escalating to the full-screen "Something went wrong"
// view in src/ErrorBoundary.tsx.

interface ViewErrorProps {
  view: string;
  error: Error;
  onReset: () => void;
}

export default function ViewError({ view, error, onReset }: ViewErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-1 items-center justify-center p-10"
      style={{ minHeight: 320 }}
    >
      <div className="max-w-[420px] text-center">
        <h2
          className="f-serif"
          style={{
            fontSize: 22,
            fontWeight: 450,
            letterSpacing: "-0.005em",
            color: "var(--ink)",
            margin: "0 0 12px",
          }}
        >
          {view} hit an error.
        </h2>
        <p
          className="f-serif"
          style={{
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--ink-faint)",
            margin: "0 0 16px",
            lineHeight: 1.55,
          }}
        >
          The rest of Everion is fine. Your data is safe.
        </p>
        <p
          className="f-mono"
          style={{
            fontSize: 11,
            color: "var(--ink-faint)",
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 6,
            padding: "8px 10px",
            margin: "0 0 20px",
            wordBreak: "break-word",
            textAlign: "left",
          }}
        >
          {error.message || "Unknown error"}
        </p>
        <button type="button" onClick={onReset} className="design-btn-primary press">
          Try again
        </button>
      </div>
    </div>
  );
}
