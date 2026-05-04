import { useEffect, useState } from "react";
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
  sourceBrain: Brain;
  brains: Brain[];
  onClose: () => void;
  onChanged?: () => void;
}

// Share-overlay (migration 070): a single entry stays owned by its source
// brain but becomes visible inside any number of other brains via the
// entry_shares table. This modal toggles those rows.
export default function ShareToBrainsModal({
  entry,
  sourceBrain,
  brains,
  onClose,
  onChanged,
}: Props) {
  const others = brains.filter((b) => b.id !== sourceBrain.id);
  const [shared, setShared] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch(`/api/entries?action=shares&id=${encodeURIComponent(entry.id)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { shares?: { target_brain_id: string }[] };
        if (!cancelled) {
          setShared(new Set((data.shares ?? []).map((s) => s.target_brain_id)));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load shares");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  async function toggle(brainId: string) {
    if (pending.has(brainId)) return;
    const isShared = shared.has(brainId);
    setPending((s) => new Set(s).add(brainId));
    setError(null);
    try {
      const action = isShared ? "unshare" : "share";
      const r = await authFetch(
        `/api/entries?action=${action}&id=${encodeURIComponent(entry.id)}&brain_id=${encodeURIComponent(brainId)}`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error((data && data.error) || `HTTP ${r.status}`);
      }
      setShared((s) => {
        const next = new Set(s);
        if (isShared) next.delete(brainId);
        else next.add(brainId);
        return next;
      });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending((s) => {
        const next = new Set(s);
        next.delete(brainId);
        return next;
      });
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
            Share with brains
          </DialogTitle>
          <DialogDescription style={{ fontSize: 13, color: "var(--ink-faint)" }}>
            &ldquo;{entry.title}&rdquo; lives in <strong>{sourceBrain.name}</strong>. Pick
            additional brains to make it visible in. Edits stay in the source brain — this is a
            visibility overlay, not a copy.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)", padding: "12px 0" }}>Loading…</p>
        ) : others.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", padding: "16px 0" }}>
            No other brains yet. Create one from the brain switcher.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {others.map((b) => {
              const isShared = shared.has(b.id);
              const isPending = pending.has(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggle(b.id)}
                  disabled={isPending}
                  className="press"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isShared ? "var(--ember-wash)" : "var(--surface)",
                    border: `1px solid ${isShared ? "var(--ember)" : "var(--line-soft)"}`,
                    borderRadius: 8,
                    color: "var(--ink)",
                    fontFamily: "var(--f-sans)",
                    fontSize: 13,
                    textAlign: "left",
                    cursor: isPending ? "default" : "pointer",
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `1.5px solid ${isShared ? "var(--ember)" : "var(--line-soft)"}`,
                      background: isShared ? "var(--ember)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isShared && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
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
          <div role="alert" style={{ fontSize: 12, color: "var(--blood)" }}>
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={onClose} variant="outline" size="sm">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
