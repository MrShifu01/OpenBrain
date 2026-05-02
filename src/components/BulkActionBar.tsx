import { useState, useEffect, type JSX } from "react";
import { authFetch } from "../lib/authFetch";
import { CANONICAL_TYPES } from "../types";
import type { Brain, Entry } from "../types";
import { Button } from "./ui/button";

interface Props {
  selectedIds: Set<string>;
  entries: Entry[];
  brains: Brain[];
  onDone: (updatedEntries: Entry[]) => void;
  onCancel: () => void;
  onSelectAll?: () => void;
  onDelete?: (ids: string[]) => Promise<void>;
  allSelected?: boolean;
}

type Phase = "idle" | "typing" | "confirmDelete";

export default function BulkActionBar({
  selectedIds,
  entries,
  brains: _brains,
  onDone,
  onCancel,
  onSelectAll,
  onDelete,
  allSelected = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [suggested, setSuggested] = useState<string | null>(null);

  // Reset phase when the selection changes externally — keeps a stale "Are
  // you sure you want to delete?" from sitting around after the user has
  // already cleared selection.
  useEffect(() => {
    if (selectedIds.size === 0) {
      setPhase("idle");
      setSuggested(null);
    }
  }, [selectedIds.size]);

  const count = selectedIds.size;

  async function applyType(type: string) {
    if (busy) return;
    setBusy(true);
    const ids = [...selectedIds];
    const updated: Entry[] = [];
    for (const id of ids) {
      try {
        const res = await authFetch("/api/update-entry", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, type }),
        });
        if (res.ok) updated.push(await res.json());
      } catch (err) {
        console.error("[BulkActionBar] type update failed", id, err);
      }
    }
    setBusy(false);
    setPhase("idle");
    setSuggested(null);
    onDone(updated);
  }

  async function suggestType() {
    if (aiTyping) return;
    setAiTyping(true);
    try {
      const selected = entries.filter((e) => selectedIds.has(e.id)).slice(0, 5);
      const sample = selected
        .map((e) => `- ${e.title}: ${(e.content || "").slice(0, 120)}`)
        .join("\n");
      const types = CANONICAL_TYPES.filter((t) => t !== "secret");
      const res = await authFetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `Reply with ONE word only — the best category for these entries. Pick from: ${types.join(", ")}. No explanation.`,
          messages: [{ role: "user", content: `Entries:\n${sample}` }],
          max_tokens: 20,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const full = (data.content?.[0]?.text || data.choices?.[0]?.message?.content || "")
          .trim()
          .toLowerCase();
        const raw = full.replace(/[^a-z]/g, " ");
        const match = types
          .map((t) => ({ t, idx: raw.search(new RegExp(`\\b${t}\\b`)) }))
          .filter((m) => m.idx >= 0)
          .sort((a, b) => a.idx - b.idx)[0]?.t;
        if (match) setSuggested(match);
      }
    } catch (err) {
      console.error("[BulkActionBar] suggestType failed", err);
    }
    setAiTyping(false);
  }

  async function bulkDelete() {
    if (!onDelete || busy) return;
    setBusy(true);
    try {
      await onDelete([...selectedIds]);
    } finally {
      setBusy(false);
      setPhase("idle");
      onCancel();
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
        zIndex: "var(--z-fab)",
        width: "min(96vw, 520px)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 12,
          borderRadius: 16,
          background: "var(--surface-high)",
          border: "1px solid var(--line)",
          boxShadow: "var(--lift-3)",
        }}
      >
        {/* Header row — mirrors SomedayBulkBar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            {count} selected
          </span>
          <span style={{ flex: 1 }} />
          {onSelectAll && (
            <Button size="xs" variant="outline" onClick={onSelectAll}>
              {allSelected ? "Clear" : "Select all"}
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={onCancel} aria-label="Cancel selection">
            Cancel
          </Button>
        </div>

        {phase === "idle" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionBtn
              label="Change type"
              tone="ember"
              disabled={busy}
              onClick={() => setPhase("typing")}
            />
            {onDelete && (
              <ActionBtn
                label={`Delete · ${count}`}
                tone="ghost"
                disabled={busy}
                onClick={() => setPhase("confirmDelete")}
              />
            )}
          </div>
        )}

        {phase === "typing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p className="f-sans" style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>
                Change {count} {count === 1 ? "entry" : "entries"} to…
              </p>
              <Button
                size="xs"
                variant="outline"
                onClick={suggestType}
                disabled={aiTyping || busy}
                aria-label="Suggest a type with AI"
              >
                {aiTyping ? "…" : "✦ AI"}
              </Button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CANONICAL_TYPES.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={suggested === t ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => applyType(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPhase("idle");
                  setSuggested(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {phase === "confirmDelete" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p
              className="f-sans"
              style={{ margin: 0, fontSize: 12, color: "var(--ink)", lineHeight: 1.45 }}
            >
              Delete {count} {count === 1 ? "entry" : "entries"}? This can&apos;t be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button size="sm" variant="outline" onClick={() => setPhase("idle")}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={bulkDelete}>
                {busy ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "ember" | "moss" | "ghost";
}): JSX.Element {
  const variant = tone === "ember" ? "default" : tone === "moss" ? "moss" : "outline";
  return (
    <Button
      variant={variant}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className="flex-1"
    >
      {label}
    </Button>
  );
}
