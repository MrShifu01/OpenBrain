import { useState } from "react";
import { authFetch } from "../lib/authFetch";
import type { Brain } from "../types";
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
  onClose: () => void;
  onCreated: (brain: Brain) => void;
}

export default function CreateBrainModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        style={{ background: "var(--bg)", borderColor: "var(--line-soft)" }}
      >
        <form onSubmit={submit}>
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
              New brain
            </DialogTitle>
            <DialogDescription style={{ fontSize: 13, color: "var(--ink-faint)" }}>
              A blank space for whatever you want — work, family, a hobby. Switch between brains
              from the header.
            </DialogDescription>
          </DialogHeader>

          <label style={{ display: "block", marginTop: 14 }}>
            <span
              style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}
            >
              Name
            </span>
            <input
              autoFocus
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

          <label style={{ display: "block", marginTop: 14 }}>
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
            <div role="alert" style={{ fontSize: 12, color: "var(--blood)", marginTop: 12 }}>
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" onClick={onClose} disabled={saving} variant="outline" size="sm">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || saving} size="sm">
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
