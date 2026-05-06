import { useState } from "react";
import { authFetch } from "../lib/authFetch";
import type { Brain, Entry } from "../types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: "var(--bg)",
          borderColor: "var(--line-soft)",
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="f-serif"
            style={{
              fontSize: 22,
              fontWeight: 450,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            Move to brain
          </DialogTitle>
          <DialogDescription style={{ fontSize: 13, color: "var(--ink-faint)" }}>
            Move &ldquo;{entry.title}&rdquo; from <strong>{currentBrain.name}</strong>.
            Concept-graph links in the source brain are removed; embeddings refresh in the
            destination.
          </DialogDescription>
        </DialogHeader>

        {others.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", padding: "16px 0" }}>
            No other brains yet. Create one from the brain switcher.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {others.map((b) => {
              const isPicked = picked?.id === b.id;
              return (
                <Button
                  key={b.id}
                  type="button"
                  variant="outline"
                  onClick={() => setPicked(b)}
                  className="h-auto justify-start"
                  style={{
                    padding: "10px 12px",
                    background: isPicked ? "var(--ember-wash)" : "var(--surface)",
                    borderColor: isPicked ? "var(--ember)" : "var(--line-soft)",
                    color: "var(--ink)",
                    fontFamily: "var(--f-sans)",
                    fontSize: 13,
                    textAlign: "left",
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
                </Button>
              );
            })}
          </div>
        )}

        {error && (
          <div role="alert" style={{ fontSize: 12, color: "var(--blood)" }}>
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={onClose} disabled={saving} variant="outline" size="sm">
            Cancel
          </Button>
          <Button type="button" onClick={move} disabled={!picked || saving} size="sm">
            {saving ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
