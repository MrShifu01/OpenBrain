import { useEffect, useState } from "react";
import FocusTrap from "focus-trap-react";
import { authFetch } from "../lib/authFetch";
import type { Brain, Entry } from "../types";

interface Props {
  entry: Entry;
  currentBrain: Brain;
  brains: Brain[];
  onClose: () => void;
  onMoved: (brain: Brain) => void;
}

export default function MoveToBrainModal({ entry, currentBrain, brains, onClose, onMoved }: Props) {
  const [picked, setPicked] = useState<Brain | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const others = brains.filter((b) => b.id !== currentBrain.id);

  async function move() {
    if (!picked || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await authFetch(
        `/api/entries?action=move&id=${encodeURIComponent(entry.id)}&brain_id=${encodeURIComponent(picked.id)}`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error((data && data.error) || `HTTP ${r.status}`);
      }
      onMoved(picked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed");
      setSaving(false);
    }
  }

  return (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: false,
        escapeDeactivates: true,
        clickOutsideDeactivates: true,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-brain-title"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 110,
          padding: 16,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: "var(--bg)",
            borderRadius: 12,
            padding: 24,
            width: "100%",
            maxWidth: 440,
            border: "1px solid var(--line-soft)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          <h2
            id="move-brain-title"
            className="f-serif"
            style={{
              fontSize: 22,
              fontWeight: 450,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              marginBottom: 4,
            }}
          >
            Move to brain
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 18 }}>
            Move &ldquo;{entry.title}&rdquo; from <strong>{currentBrain.name}</strong>.
            Concept-graph links in the source brain are removed; embeddings refresh in the
            destination.
          </p>

          {others.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-soft)", padding: "16px 0" }}>
              No other brains yet. Create one from the brain switcher.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {others.map((b) => {
                const isPicked = picked?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setPicked(b)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 12px",
                      background: isPicked ? "var(--ember-wash)" : "var(--surface)",
                      border: `1px solid ${isPicked ? "var(--ember)" : "var(--line-soft)"}`,
                      borderRadius: 8,
                      color: "var(--ink)",
                      fontFamily: "var(--f-sans)",
                      fontSize: 13,
                      textAlign: "left",
                      cursor: "pointer",
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
                      {b.description && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--ink-faint)",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {b.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div role="alert" style={{ fontSize: 12, color: "var(--blood)", marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="press"
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={move}
              disabled={!picked || saving}
              className="press"
              style={{
                padding: "8px 14px",
                background: picked && !saving ? "var(--ember)" : "var(--surface)",
                border: 0,
                borderRadius: 8,
                color: picked && !saving ? "var(--bg)" : "var(--ink-faint)",
                fontSize: 13,
                fontWeight: 600,
                cursor: picked && !saving ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Moving…" : "Move"}
            </button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
