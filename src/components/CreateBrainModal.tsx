import { useEffect, useRef, useState } from "react";
import FocusTrap from "focus-trap-react";
import { authFetch } from "../lib/authFetch";
import type { Brain } from "../types";

interface Props {
  onClose: () => void;
  onCreated: (brain: Brain) => void;
}

export default function CreateBrainModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await authFetch("/api/brains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error((data && data.error) || `HTTP ${r.status}`);
      }
      const brain: Brain = await r.json();
      onCreated(brain);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brain");
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
        aria-labelledby="create-brain-title"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: 16,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <form
          onSubmit={submit}
          style={{
            background: "var(--bg)",
            borderRadius: 12,
            padding: 24,
            width: "100%",
            maxWidth: 420,
            border: "1px solid var(--line-soft)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          <h2
            id="create-brain-title"
            className="f-serif"
            style={{
              fontSize: 22,
              fontWeight: 450,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              marginBottom: 4,
            }}
          >
            New brain
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 18 }}>
            A blank space for whatever you want — work, family, a hobby. Switch between brains from
            the header.
          </p>

          <label style={{ display: "block", marginBottom: 14 }}>
            <span
              style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}
            >
              Name
            </span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Smash Burger Bar"
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--surface)",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
                color: "var(--ink)",
                fontSize: 14,
                fontFamily: "var(--f-sans)",
              }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 18 }}>
            <span
              style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}
            >
              Description <span style={{ color: "var(--ink-faint)" }}>(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="What lives in this brain?"
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--surface)",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
                color: "var(--ink)",
                fontSize: 13,
                fontFamily: "var(--f-sans)",
                resize: "vertical",
              }}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                fontSize: 12,
                color: "var(--blood)",
                marginBottom: 12,
              }}
            >
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
              type="submit"
              disabled={!name.trim() || saving}
              className="press"
              style={{
                padding: "8px 14px",
                background: name.trim() && !saving ? "var(--ember)" : "var(--surface)",
                border: 0,
                borderRadius: 8,
                color: name.trim() && !saving ? "var(--bg)" : "var(--ink-faint)",
                fontSize: 13,
                fontWeight: 600,
                cursor: name.trim() && !saving ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </FocusTrap>
  );
}
