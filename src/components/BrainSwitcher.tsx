import { useEffect, useRef, useState } from "react";
import { useBrain } from "../context/BrainContext";
import { authFetch } from "../lib/authFetch";
import CreateBrainModal from "./CreateBrainModal";
import type { Brain } from "../types";

interface Props {
  /** Optional — when true the dropdown opens upward (used in mobile menus). */
  dropUp?: boolean;
  /** Compact pill rendering for tight spots like CaptureSheet header. */
  compact?: boolean;
  /** Override what happens after picking a brain (e.g. CaptureSheet wants
   *  per-capture redirect, not global switch). When omitted, switches the
   *  app-wide active brain. */
  onPick?: (brain: Brain) => void;
  /** Hide "+ New brain" footer (e.g. in CaptureSheet). */
  hideCreate?: boolean;
}

export default function BrainSwitcher({ dropUp, compact, onPick, hideCreate }: Props) {
  const { activeBrain, brains, setActiveBrain, refresh } = useBrain();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!activeBrain) return null;

  const personal = brains.find((b) => b.is_personal);
  const others = brains.filter((b) => !b.is_personal).sort((a, b) => a.name.localeCompare(b.name));
  const sorted = personal ? [personal, ...others] : others;

  async function pick(brain: Brain) {
    setOpen(false);
    if (brain.id === activeBrain?.id) return;
    if (onPick) {
      onPick(brain);
      return;
    }
    setActiveBrain(brain);
    // Persist cross-device. Best-effort; localStorage already updated by setActiveBrain.
    authFetch("/api/brains?action=set-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: brain.id }),
    }).catch(() => {});
  }

  const truncate = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active brain: ${activeBrain.name}. Click to switch.`}
        className="press"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: compact ? 28 : 32,
          padding: compact ? "0 8px" : "0 10px",
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 8,
          color: "var(--ink)",
          fontFamily: "var(--f-sans)",
          fontSize: compact ? 12 : 13,
          fontWeight: 500,
          cursor: "pointer",
          maxWidth: compact ? 160 : 220,
          minWidth: 0,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {truncate(activeBrain.name, compact ? 16 : 22)}
        </span>
        <svg
          aria-hidden="true"
          width="10"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          style={{ flexShrink: 0, opacity: 0.6 }}
        >
          {dropUp ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            ...(dropUp ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
            left: 0,
            minWidth: 240,
            maxWidth: 320,
            background: "var(--bg)",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
            padding: 4,
            zIndex: 60,
          }}
        >
          {sorted.map((b) => {
            const isActive = b.id === activeBrain.id;
            return (
              <button
                key={b.id}
                role="option"
                aria-selected={isActive}
                onClick={() => pick(b)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  background: isActive ? "var(--ember-wash)" : "transparent",
                  border: 0,
                  borderRadius: 6,
                  color: "var(--ink)",
                  fontFamily: "var(--f-sans)",
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.name}
                  </div>
                  {b.is_personal && (
                    <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 1 }}>
                      Personal
                    </div>
                  )}
                </div>
                {isActive && (
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--ember)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}

          {!hideCreate && (
            <>
              <div style={{ height: 1, background: "var(--line-soft)", margin: "4px 0" }} />
              <button
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  background: "transparent",
                  border: 0,
                  borderRadius: 6,
                  color: "var(--ember)",
                  fontFamily: "var(--f-sans)",
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "var(--ember-wash)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                <span style={{ width: 14, textAlign: "center" }}>+</span>
                <span>New brain</span>
              </button>
            </>
          )}
        </div>
      )}

      {creating && (
        <CreateBrainModal
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
