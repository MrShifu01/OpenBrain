import { useState, useEffect, useRef } from "react";
import { TC } from "../data/constants";
import { extractPhone, toWaUrl } from "../lib/phone";
import type { Entry, Brain, EntryType } from "../types";

interface DetailLink {
  from: string;
  to: string;
  rel?: string;
  similarity?: number;
}

interface DetailModalProps {
  entry: Entry;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: (id: string, changes: any) => Promise<void>;
  onReorder?: (entry: any) => void;
  entries?: Entry[];
  links?: DetailLink[];
  canWrite?: boolean;
  brains?: Brain[];
  vaultUnlocked?: boolean;
}

export default function DetailModal({
  entry,
  onClose,
  onDelete,
  onUpdate,
  onReorder,
  entries = [],
  links = [],
  canWrite = true,
  brains = [],
  vaultUnlocked = false,
}: DetailModalProps) {
  if (!entry) return null;
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title);
  const [editContent, setEditContent] = useState(entry.content);
  const [editType, setEditType] = useState<string>(entry.type);
  const [editTags, setEditTags] = useState((entry.tags || []).join(", "));
  const [editBrainId, setEditBrainId] = useState(entry.brain_id || "");
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [secretRevealed, setSecretRevealed] = useState(false);
  const isSecret = entry.type === "secret";
  const cfg = TC[editType as EntryType] || TC.note;
  const related = links
    .filter((l) => l.from === entry.id || l.to === entry.id)
    .map((l) => ({
      ...l,
      other: entries.find((e) => e.id === (l.from === entry.id ? l.to : l.from)),
      dir: l.from === entry.id ? "→" : "←",
    }));
  const skip = new Set(["category", "status"]);
  const meta = Object.entries(entry.metadata || {}).filter(([k]) => !skip.has(k));

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  // UX-5: Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) setEditing(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editing, onClose]);

  const handleSave = async () => {
    setSaving(true);
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const changes: Record<string, any> = {
      title: editTitle,
      content: editContent,
      type: editType,
      tags,
    };
    if (editBrainId && editBrainId !== entry.brain_id) changes.brain_id = editBrainId;
    await onUpdate?.(entry.id, changes);
    setSaving(false);
    setEditing(false);
  };

  const handleShare = async () => {
    const phone = extractPhone(entry);
    const text = [
      entry.title,
      entry.content,
      phone ? `📞 ${phone}` : null,
      Object.entries(entry.metadata || {})
        .filter(([k]) => !["category", "workspace"].includes(k))
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("\n") || null,
      "— from OpenBrain",
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: entry.title, text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setShareMsg("Copied to clipboard");
      setTimeout(() => setShareMsg(null), 2500);
    }
  };

  const phone = extractPhone(entry);
  const isSupplier = entry.tags?.includes("supplier") || entry.metadata?.category === "supplier";

  // Build quick actions for this entry type
  const quickActions = [];

  if (isSupplier || entry.type === "contact" || entry.type === "person") {
    if (phone) {
      quickActions.push(
        <a
          key="call"
          href={`tel:${phone}`}
          className="border-teal/25 bg-teal/[0.08] text-teal inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap no-underline"
        >
          📞 Call
        </a>,
      );
      quickActions.push(
        <a
          key="wa"
          href={toWaUrl(phone)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border border-[#25D366]/25 bg-[#25D366]/[0.08] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#25D366] no-underline"
        >
          💬 WhatsApp
        </a>,
      );
    }
    if (isSupplier && onReorder) {
      quickActions.push(
        <button
          key="reorder"
          onClick={() => onReorder(entry)}
          className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border border-[#FF6B35]/25 bg-[#FF6B35]/[0.08] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#FF6B35]"
        >
          🔁 Reorder
        </button>,
      );
    }
  }

  if (entry.type === "reminder") {
    if (entry.metadata?.status !== "done") {
      quickActions.push(
        <button
          key="done"
          onClick={() =>
            onUpdate?.(entry.id, { metadata: { ...entry.metadata, status: "done" }, importance: 0 })
          }
          className="border-teal/25 bg-teal/[0.08] text-teal inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
        >
          ✅ Mark Done
        </button>,
      );
    }
    quickActions.push(
      <button
        key="snooze1w"
        onClick={() => {
          const d = new Date(entry.metadata?.due_date || Date.now());
          d.setDate(d.getDate() + 7);
          onUpdate?.(entry.id, {
            metadata: { ...entry.metadata, due_date: d.toISOString().split("T")[0] },
          });
        }}
        className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border border-[#A29BFE]/25 bg-[#A29BFE]/[0.08] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#A29BFE]"
      >
        ⏰ +1 week
      </button>,
    );
    quickActions.push(
      <button
        key="snooze1m"
        onClick={() => {
          const d = new Date(entry.metadata?.due_date || Date.now());
          d.setMonth(d.getMonth() + 1);
          onUpdate?.(entry.id, {
            metadata: { ...entry.metadata, due_date: d.toISOString().split("T")[0] },
          });
        }}
        className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border border-[#A29BFE]/25 bg-[#A29BFE]/[0.08] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#A29BFE]"
      >
        ⏰ +1 month
      </button>,
    );
  }

  if (entry.type === "idea") {
    if (entry.metadata?.status !== "in_progress") {
      quickActions.push(
        <button
          key="start"
          onClick={() =>
            onUpdate?.(entry.id, { metadata: { ...entry.metadata, status: "in_progress" } })
          }
          className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border border-[#FFEAA7]/25 bg-[#FFEAA7]/[0.08] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#FFEAA7]"
        >
          🚀 Start this
        </button>,
      );
    }
    if (entry.metadata?.status !== "archived") {
      quickActions.push(
        <button
          key="archive"
          onClick={() =>
            onUpdate?.(entry.id, { metadata: { ...entry.metadata, status: "archived" } })
          }
          className="border-ob-text-faint/25 bg-ob-text-faint/[0.08] text-ob-text-faint inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
        >
          📦 Archive
        </button>,
      );
    }
  }

  if (entry.type === "document" && onReorder) {
    quickActions.push(
      <button
        key="renewal"
        onClick={() => onReorder({ ...entry, _renewalMode: true })}
        className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border border-[#FF6B35]/25 bg-[#FF6B35]/[0.08] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#FF6B35]"
      >
        🔔 Set renewal reminder
      </button>,
    );
  }

  if (isSecret) {
    if (secretRevealed) {
      quickActions.push(
        <button
          key="copy-secret"
          onClick={() => {
            navigator.clipboard.writeText(entry.content || "").then(() => {
              setShareMsg("Copied to clipboard");
              setTimeout(() => setShareMsg(null), 2500);
            });
          }}
          className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border border-[#FF4757]/25 bg-[#FF4757]/[0.08] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#FF4757]"
        >
          📋 Copy
        </button>,
      );
      quickActions.push(
        <button
          key="hide-secret"
          onClick={() => setSecretRevealed(false)}
          className="border-ob-text-faint/25 bg-ob-text-faint/[0.08] text-ob-text-faint inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
        >
          👁 Hide
        </button>,
      );
    }
  }

  // Share always available (but not for secret entries)
  if (!isSecret)
    quickActions.push(
      <button
        key="share"
        onClick={handleShare}
        className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] border border-[#45B7D1]/25 bg-[#45B7D1]/[0.08] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#45B7D1]"
      >
        📤 Share
      </button>,
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#000000CC] p-3"
      onClick={editing ? undefined : onClose}
    >
      <div
        className={`bg-ob-surface2 max-h-[90vh] w-full max-w-[600px] overflow-auto rounded-2xl border border-[${cfg.c}40]`}
        style={{ borderColor: `${cfg.c}40` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-ob-border flex justify-between border-b p-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">{cfg.i}</span>
              <span
                className="text-[11px] font-bold tracking-[1.5px] uppercase"
                style={{ color: cfg.c }}
              >
                {editType}
              </span>
            </div>
            {!editing && (
              <h2 id="detail-modal-title" className="text-ob-text m-0 text-[22px] font-bold">
                {editTitle}
              </h2>
            )}
          </div>
          <div className="flex items-start gap-2">
            {!editing && canWrite && onDelete && (
              <button
                onClick={async () => {
                  if (!confirmingDelete) {
                    setConfirmingDelete(true);
                    confirmTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
                  } else {
                    setDeleting(true);
                    await onDelete(entry.id);
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className={`rounded-lg border border-[#FF6B35]/25 px-3.5 py-1.5 text-xs font-semibold ${deleting ? "bg-ob-surface text-ob-text-faint cursor-default" : confirmingDelete ? "cursor-pointer bg-[#FF6B35]/25 text-[#FF6B35]" : "cursor-pointer bg-[#FF6B35]/[0.12] text-[#FF6B35]"}`}
              >
                {deleting ? "Deleting..." : confirmingDelete ? "Confirm delete?" : "Delete"}
              </button>
            )}
            {!editing && canWrite && onUpdate && (
              <button
                onClick={() => setEditing(true)}
                className="bg-ob-accent-light border-ob-accent-border text-ob-accent cursor-pointer rounded-lg border px-3.5 py-1.5 text-xs font-semibold"
              >
                Edit
              </button>
            )}
            {!canWrite && (
              <span className="text-ob-text-dim px-2 py-1.5 text-[11px]">🔒 View only</span>
            )}
            <button
              onClick={editing ? () => setEditing(false) : onClose}
              className="text-ob-text-dim cursor-pointer border-none bg-transparent text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="flex flex-col gap-3.5 p-4">
            <div>
              <label className="text-ob-text-muted mb-1.5 block text-[11px] tracking-[1px] uppercase">
                Title
              </label>
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-ob-bg border-ob-accent-border text-ob-text-soft box-border w-full rounded-[10px] border px-3.5 py-2.5 font-[inherit] text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-ob-text-muted mb-1.5 block text-[11px] tracking-[1px] uppercase">
                Type
              </label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="bg-ob-bg border-ob-accent-border text-ob-text-soft box-border w-full cursor-pointer rounded-[10px] border px-3.5 py-2.5 font-[inherit] text-sm outline-none"
              >
                {[
                  "note",
                  "person",
                  "place",
                  "idea",
                  "contact",
                  "document",
                  "reminder",
                  "color",
                  "decision",
                  "secret",
                ].map((typ) => (
                  <option key={typ} value={typ}>
                    {typ}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-ob-text-muted mb-1.5 block text-[11px] tracking-[1px] uppercase">
                Content
              </label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                className="bg-ob-bg border-ob-accent-border text-ob-text-soft box-border w-full resize-y rounded-[10px] border px-3.5 py-2.5 font-[inherit] text-sm leading-[1.6] outline-none"
              />
            </div>
            <div>
              <label className="text-ob-text-muted mb-1.5 block text-[11px] tracking-[1px] uppercase">
                Tags{" "}
                <span className="text-ob-text-faint font-normal normal-case">
                  (comma separated)
                </span>
              </label>
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="bg-ob-bg border-ob-accent-border text-ob-text-soft box-border w-full rounded-[10px] border px-3.5 py-2.5 font-[inherit] text-sm outline-none"
                placeholder="tag1, tag2, tag3"
              />
            </div>
            {brains.length > 1 && (
              <div>
                <label className="text-ob-text-muted mb-1.5 block text-[11px] tracking-[1px] uppercase">
                  Brain
                </label>
                <div className="flex flex-wrap gap-2">
                  {brains.map((b) => {
                    const emoji = b.type === "family" ? "🏠" : b.type === "business" ? "🏪" : "🧠";
                    const active = editBrainId === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setEditBrainId(b.id)}
                        className={`cursor-pointer rounded-[20px] px-3.5 py-1.5 text-xs font-semibold ${active ? "border-teal bg-teal/[0.12] text-teal border" : "border-ob-border bg-ob-surface text-ob-text-dim border"}`}
                      >
                        {emoji} {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-1 flex gap-2.5">
              <button
                onClick={() => setEditing(false)}
                className="bg-ob-surface border-ob-border text-ob-text-muted flex-1 cursor-pointer rounded-[10px] border p-3 text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editTitle.trim()}
                className={`flex-[2] rounded-[10px] border-none p-3 text-[13px] font-bold ${editTitle.trim() ? "gradient-accent text-ob-bg cursor-pointer" : "bg-ob-surface text-ob-text-dim cursor-default"}`}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {isSecret && !secretRevealed ? (
              <div className="px-4 py-6 text-center">
                <div className="mb-3 text-[32px]">{vaultUnlocked ? "🔐" : "🔒"}</div>
                <p className="text-ob-text-dim m-0 mb-4 text-[13px]">
                  {vaultUnlocked
                    ? "This entry is end-to-end encrypted"
                    : "Unlock your Vault to view this secret"}
                </p>
                {vaultUnlocked ? (
                  <button
                    onClick={() => setSecretRevealed(true)}
                    className="min-h-11 cursor-pointer rounded-[10px] border-none bg-gradient-to-br from-[#FF4757] to-[#FF6B81] px-6 py-2.5 text-[13px] font-bold text-white"
                  >
                    Reveal content
                  </button>
                ) : (
                  <p className="text-xs text-[#FF4757]">
                    Go to the Vault tab and enter your passphrase
                  </p>
                )}
              </div>
            ) : (
              <>
                <p
                  className={`text-ob-text-mid m-0 text-sm leading-[1.7] ${isSecret ? "rounded-lg border border-[#FF4757]/[0.19] bg-[#FF4757]/[0.06] p-3 font-mono" : ""}`}
                >
                  {editContent}
                </p>
                {meta.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {meta.map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <span className="text-ob-text-muted capitalize">
                          {k.replace(/_/g, " ")}:{" "}
                        </span>
                        <span className={`text-ob-text-mid ${isSecret ? "font-mono" : ""}`}>
                          {Array.isArray(v) ? v.join(", ") : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {editTags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean).length > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-1.5">
                  {editTags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[20px] px-3 py-1 text-[11px]"
                        style={{ color: cfg.c, background: cfg.c + "15" }}
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            )}
            {related.length > 0 && (
              <div className="border-ob-border mt-5 border-t pt-4">
                <p className="text-ob-text-dim mb-2.5 text-[11px] font-semibold uppercase">
                  Connections
                </p>
                {related.map(
                  (r, i) =>
                    r.other && (
                      <div
                        key={i}
                        className="mb-1 flex items-center gap-2 rounded-lg bg-[#ffffff05] px-3 py-2 text-[13px]"
                      >
                        <span>{TC[r.other.type]?.i}</span>
                        <span className="text-ob-text-muted">{r.dir}</span>
                        <span className="text-ob-text-mid flex-1">{r.other.title}</span>
                        <span className="text-ob-text-dim text-[11px] italic">{r.rel}</span>
                      </div>
                    ),
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {!editing && quickActions.length > 0 && (
          <div className="border-ob-border/25 border-t px-4 pb-4">
            <div className="flex flex-wrap gap-2 pt-4">{quickActions}</div>
            {shareMsg && <p className="text-ob-accent mt-2 mb-0 text-[11px]">{shareMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
