import { useEffect, useRef, useState } from "react";
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

// Controlled merge UI. The PREVIEW fetch lives in Everion.tsx so the user
// can close the modal mid-generation without killing the request — the
// session keeps running, a sonner Review toast fires when ready, and
// re-opening the modal shows the cached preview without re-hitting the LLM.
//
// This component is purely presentational on (status, preview, error). It
// owns the local edit state (title/content/tags) so user edits survive a
// hide/show cycle as long as the session itself is alive.
//
// Commit path stays local: on Save & Replace we POST preview=false with
// the edited fields, surface the post-merge Undo toast, and fire
// onCommitted to clear the session.

export interface MergePreviewShape {
  title: string;
  content: string;
  type: string;
  tags: string[];
  source_count: number;
}

interface Props {
  ids: string[];
  open: boolean;
  status: "loading" | "ready" | "error";
  preview: MergePreviewShape | null;
  error: string | null;
  /** User dismissed the modal (X / outside / Hide). Session stays alive. */
  onHide: () => void;
  /** User cancelled — kill the session entirely. */
  onCancel: () => void;
  onCommitted: (mergedId: string, sourceIds: string[], merged: unknown) => void;
}

export default function MergePreviewModal({
  ids,
  open,
  status,
  preview,
  error,
  onHide,
  onCancel,
  onCommitted,
}: Props) {
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const initializedRef = useRef(false);

  // Populate edit fields once when the preview first arrives. After that,
  // user edits are preserved across hide/show cycles — we never overwrite.
  useEffect(() => {
    if (preview && !initializedRef.current) {
      setEditTitle(preview.title);
      setEditContent(preview.content);
      setEditTags((preview.tags || []).join(", "));
      initializedRef.current = true;
    }
  }, [preview]);

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
        merged?: unknown;
        enrichment_pending?: boolean;
      };

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
            } catch (err) {
              toast.error(`Undo failed: ${err instanceof Error ? err.message : "unknown error"}`);
            }
          },
        },
      });

      onCommitted(data.merged_id, data.source_ids, data.merged);
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Merge failed");
      setCommitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !committing && onHide()}>
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
            {status === "loading"
              ? "AI is combining your selection. You can hide this and we'll let you know when it's ready."
              : "The AI has combined your selection into a single entry. Edit anything you want — the originals stay safe until you save."}
          </DialogDescription>
        </DialogHeader>

        {status === "loading" && !preview && (
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

        {status === "error" && error && (
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
            {error}
          </div>
        )}

        {preview && status !== "error" && (
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
          {status === "loading" && (
            <>
              <Button variant="ghost" onClick={onCancel} disabled={committing}>
                Cancel
              </Button>
              <Button variant="outline" onClick={onHide} disabled={committing}>
                Hide — notify when ready
              </Button>
            </>
          )}
          {status !== "loading" && (
            <>
              <Button variant="ghost" onClick={onCancel} disabled={committing}>
                Cancel
              </Button>
              {status === "ready" && (
                <Button onClick={commit} disabled={committing || !preview}>
                  {committing
                    ? "Merging…"
                    : `Save & Replace ${ids.length} ${ids.length === 1 ? "entry" : "entries"}`}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
