import { useState, useEffect } from "react";

interface UndoToastProps {
  action: { type: "delete" | "update" | "create"; entry?: any; id?: string };
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ action, onUndo, onDismiss }: UndoToastProps) {
  const duration = action.type === "create" ? 3000 : 5000;
  const [pct, setPct] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const p = Math.max(0, 100 - ((Date.now() - start) / duration) * 100);
      setPct(p);
      if (p <= 0) {
        clearInterval(tick);
        onDismiss();
      }
    }, 80);
    return () => clearInterval(tick);
  }, [duration, onDismiss]);

  const label = { delete: "Entry deleted", update: "Entry updated", create: "Entry created" }[
    action.type
  ];
  const isDelete = action.type === "delete";

  return (
    <div
      role="alert"
      className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-sm overflow-hidden rounded-2xl border"
      style={{
        background: "rgba(26,25,25,0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderColor: isDelete ? "rgba(255,110,132,0.20)" : "rgba(114,239,245,0.15)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        animation: "slide-up 0.25s ease-out",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
          style={{ background: isDelete ? "rgba(255,110,132,0.1)" : "rgba(114,239,245,0.1)" }}
        >
          {isDelete ? "🗑" : "✓"}
        </div>
        <span className="flex-1 text-sm font-medium text-on-surface">{label}</span>
        {action.type !== "create" && (
          <button
            onClick={onUndo}
            className="text-primary text-xs font-bold uppercase tracking-widest hover:text-primary-dim transition-colors press-scale"
          >
            Undo
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-on-surface-variant hover:text-on-surface transition-colors ml-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="h-0.5 w-full" style={{ background: "rgba(72,72,71,0.2)" }}>
        <div
          className="h-full transition-none rounded-full"
          style={{
            width: `${pct}%`,
            background: isDelete ? "#ff6e84" : "#72eff5",
          }}
        />
      </div>
    </div>
  );
}
