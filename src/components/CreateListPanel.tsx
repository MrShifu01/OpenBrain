/**
 * Create-list panel — modal for creating a new list with optional initial
 * items. Items field runs the deterministic listParser on every keystroke
 * so the user sees a live "N items detected" preview before confirming.
 *
 * Submission:
 *  1. POST /api/capture with type="list", title, content, metadata.items=[...]
 *  2. Caller (ListsView) refreshes the entries cache + drills into the new list
 *
 * Per CLAUDE.md design philosophy: no native confirm/alert. All controls
 * use the project's design tokens; modal lives behind Radix Dialog so focus
 * trap + scroll lock + Escape come for free.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "./ui/button";
import { authFetch } from "../lib/authFetch";
import { getEmbedHeaders } from "../lib/aiSettings";
import { parseListText, MAX_ITEMS_PER_PARSE, type ListItem } from "../lib/listParser";
import { showToast } from "../lib/notifications";
import type { Entry } from "../types";

interface CreateListPanelProps {
  brainId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (entry: Entry) => void;
}

export default function CreateListPanel({
  brainId,
  open,
  onClose,
  onCreated,
}: CreateListPanelProps) {
  const [name, setName] = useState("");
  const [pasted, setPasted] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Live-parse preview. Cheap — runs in-memory only, no network.
  const detectedItems = useMemo(() => parseListText(pasted), [pasted]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on open transition; we want a clean panel each time it's shown.
      setName("");
      setPasted("");
      setSubmitting(false);
      // Defer focus until Dialog mounts.
      setTimeout(() => nameRef.current?.focus(), 30);
    }
  }, [open]);

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName || submitting) return;
    setSubmitting(true);

    // Items are stamped with order 0..N; embed item titles into the parent's
    // `content` so chat retrieval finds the list when the user asks about
    // any of its items (without per-item embedding).
    const items: ListItem[] = detectedItems;
    const itemTitlesForChat = items.map((i) => `- ${i.title}`).join("\n");
    const content = items.length ? `${trimmedName}\n\n${itemTitlesForChat}` : trimmedName;

    try {
      const res = await authFetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getEmbedHeaders() || {}) },
        body: JSON.stringify({
          p_title: trimmedName,
          p_content: content,
          p_type: "list",
          p_metadata: {
            items,
            list_v: 1,
          },
          p_tags: [],
          p_brain_id: brainId,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("[lists] create failed", res.status, errBody);
        showToast("Couldn't create list — please try again", "error");
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      const entry: Entry = {
        id: data?.id || `tmp_${Date.now()}`,
        title: trimmedName,
        content,
        type: "list",
        metadata: { items, list_v: 1 },
        tags: [],
        pinned: false,
        importance: 0,
        created_at: new Date().toISOString(),
      } as Entry;

      onCreated(entry);
      onClose();
    } catch (e) {
      console.error("[lists] create exception", e);
      showToast("Couldn't create list — please try again", "error");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-label="New list"
        className="anim-scale-in-design relative max-h-[calc(100vh-32px)] !max-w-[min(560px,calc(100vw-32px))] overflow-y-auto !rounded-[18px]"
        style={{
          padding: "32px 32px 24px",
          background: "var(--surface-high)",
          borderColor: "var(--line-soft)",
          boxShadow: "var(--lift-3)",
        }}
      >
        <VisuallyHidden>
          <DialogTitle>New list</DialogTitle>
        </VisuallyHidden>

        <div
          className="f-serif"
          style={{
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            marginBottom: 4,
          }}
        >
          new list
        </div>
        <div
          className="f-serif"
          style={{
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--ink-soft)",
            marginBottom: 24,
          }}
        >
          give it a name. paste anything below — bullets, numbered lines, plain rows, even CSV.
        </div>

        <label
          className="f-sans"
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--ink-faint)",
            marginBottom: 6,
          }}
        >
          name
        </label>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="groceries…"
          className="f-serif"
          style={{
            width: "100%",
            fontSize: 17,
            padding: "8px 0 12px",
            color: "var(--ink)",
            background: "transparent",
            border: 0,
            borderBottom: "1px solid var(--line)",
            borderRadius: 0,
            outline: "none",
            marginBottom: 24,
          }}
        />

        <label
          className="f-sans"
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--ink-faint)",
            marginBottom: 6,
          }}
        >
          items (optional — paste anything)
        </label>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder={`milk\neggs\nbread`}
          rows={6}
          className="f-sans"
          style={{
            width: "100%",
            fontSize: 14,
            lineHeight: 1.5,
            resize: "vertical",
            padding: "10px 12px",
            color: "var(--ink)",
            background: "var(--surface-low)",
            border: "1px solid var(--line-soft)",
            borderRadius: 8,
            outline: "none",
            fontFamily: "var(--f-mono, ui-monospace, monospace)",
          }}
        />

        <div
          className="f-sans"
          style={{
            fontSize: 12,
            color: detectedItems.length ? "var(--ink-soft)" : "var(--ink-faint)",
            marginTop: 8,
            fontStyle: "italic",
          }}
        >
          {detectedItems.length === 0
            ? "no items yet — that's fine, you can add some after creating"
            : detectedItems.length === MAX_ITEMS_PER_PARSE
              ? `${MAX_ITEMS_PER_PARSE} items detected (max — extra lines truncated)`
              : `${detectedItems.length} item${detectedItems.length === 1 ? "" : "s"} detected`}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 24,
            alignItems: "center",
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || submitting}>
            {submitting ? "creating…" : "create list"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
