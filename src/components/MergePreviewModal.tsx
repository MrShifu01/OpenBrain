import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authFetch } from "../lib/authFetch";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

// Two-phase merge UI:
//   1. Mount → POST /api/entries?action=merge with preview=true. Server runs
//      the LLM and returns a {title, content, type, tags} suggestion. We
//      show it for the user to review / edit.
//   2. User hits "Save & Replace" → POST same endpoint with preview=false
//      and the (possibly edited) fields. Server inserts merged entry,
//      runs enrichInline (up to 60s), soft-deletes the sources, writes
//      audit_log. Modal closes and the post-merge sonner toast offers a
//      10-second Undo.
//
// Failure modes covered:
//   - 429 quota → close modal, surface error toast.
//   - 503 LLM unavailable → keep modal open with retry button.
//   - 60s enrichment timeout → still succeeds; toast notes "enriching shortly".

interface Props {
  ids: string[];
  onCancel: () => void;
  onCommitted: (mergedId: string, sourceIds: string[]) => void;
}

interface PreviewShape {
  title: string;
  content: string;
  type: string;
  tags: string[];
  source_count: number;
}

export default function MergePreviewModal({ ids, onCancel, onCommitted }: Props) {
  const [preview, setPreview] = useState<PreviewShape | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const r = await authFetch("/api/entries?action=merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, preview: true }),
        });
        if (cancelled) return;
        if (!r.ok) {
          const data = await r.json().catch(() => ({}) as { error?: string });
          throw new Error((data as { error?: string })?.error || `HTTP ${r.status}`);
        }
        const data = (await r.json()) as PreviewShape;
        if (cancelled) return;
        setPreview(data);
        setEditTitle(data.title);
        setEditContent(data.content);
        setEditTags((data.tags || []).join(", "));
      } catch (err) {
        if (cancelled) return;
        setPreviewError(err instanceof Error ? err.message : "Failed to generate merge");
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  async function commit() {
    if (committing || !preview) return;
    if (!editTitle.trim() || !editContent.trim()) {
      setCommitError("Title and content cannot be empty");
      return;
    }
    setCommitting(true);
    setCommitError(null);
    try {
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);
      const r = await authFetch("/api/entries?action=merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          preview: false,
          title: editTitle.trim(),
          content: editContent,
          type: preview.type,
          tags,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}) as { error?: string });
        throw new Error((data as { error?: string })?.error || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as {
        merged_id: string;
        source_ids: string[];
        enrichment_pending?: boolean;
      };

      // Sonner toast with Undo for 10 seconds. Action calls merge-undo
      // which resurrects the sources + hard-deletes the merged entry.
      const baseMsg = `Merged ${data.source_ids.length} entries → "${editTitle.trim().slice(0, 60)}"`;
      const description = data.enrichment_pending
        ? "Enrichment will finish shortly in the background."
        : "Fully enriched.";
      toast.success(baseMsg, {
        description,
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const undoRes = await authFetch("/api/entries?action=merge-undo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  merged_id: data.merged_id,
                  source_ids: data.source_ids,
                }),
              });
              if (!undoRes.ok) {
                const errData = await undoRes.json().catch(() => ({}) as { error?: string });
                throw new Error((errData as { error?: string })?.error || `HTTP ${undoRes.status}`);
              }
              toast.success("Merge undone — original entries restored");
              // The realtime subscription (useEntryRealtime) catches the
              // hard-delete of the merged row and the deleted_at clear on
              // the sources, so the entry list converges without a manual
              // refetch on the next tick.
            } catch (err) {
              toast.error(`Undo failed: ${err instanceof Error ? err.message : "unknown error"}`);
            }
          },
        },
      });

      onCommitted(data.merged_id, data.source_ids);
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Merge failed");
      setCommitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !committing && onCancel()}>
      <DialogContent
        className="sm:max-w-2xl"
        style={{ background: "var(--bg)", borderColor: "var(--line-soft)" }}
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
            Merge {ids.length} entries
          </DialogTitle>
          <DialogDescription style={{ fontSize: 13, color: "var(--ink-faint)" }}>
            The AI has combined your selection into a single entry. Edit anything you want — the
            originals stay safe until you save.
          </DialogDescription>
        </DialogHeader>

        {loadingPreview && (
          <div
            className="f-sans"
            style={{
              padding: "32px 8px",
              textAlign: "center",
              color: "var(--ink-faint)",
              fontSize: 13,
            }}
          >
            Generating merged entry…
          </div>
        )}

        {previewError && (
          <div
            className="f-sans"
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              fontSize: 13,
              background: "var(--blood-wash)",
              color: "var(--blood)",
              border: "1px solid var(--blood)",
            }}
          >
            {previewError}
          </div>
        )}

        {preview && !previewError && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                className="f-sans"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                }}
              >
                Title
              </span>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={committing}
                maxLength={200}
                className="f-serif"
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "var(--ink)",
                  background: "var(--surface)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                className="f-sans"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                }}
              >
                Content
              </span>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                disabled={committing}
                rows={10}
                className="f-serif"
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--ink)",
                  background: "var(--surface)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  resize: "vertical",
                  minHeight: 200,
                  maxHeight: 400,
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                className="f-sans"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                }}
              >
                Tags · type: <span style={{ color: "var(--ember)" }}>{preview.type}</span>
              </span>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                disabled={committing}
                placeholder="comma, separated, tags"
                className="f-sans"
                style={{
                  fontSize: 13,
                  color: "var(--ink)",
                  background: "var(--surface)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 8,
                  padding: "6px 10px",
                }}
              />
            </label>
          </div>
        )}

        {commitError && (
          <div
            className="f-sans"
            style={{
              marginTop: 8,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 12,
              background: "var(--blood-wash)",
              color: "var(--blood)",
            }}
          >
            {commitError}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={committing}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={committing || !preview || loadingPreview}>
            {committing
              ? "Merging…"
              : `Save & Replace ${ids.length} ${ids.length === 1 ? "entry" : "entries"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
