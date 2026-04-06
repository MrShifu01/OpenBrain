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
        <a key="call" href={`tel:${phone}`}>
          📞 Call
        </a>,
      );
      quickActions.push(
        <a key="wa" href={toWaUrl(phone)} target="_blank" rel="noreferrer">
          💬 WhatsApp
        </a>,
      );
    }
    if (isSupplier && onReorder) {
      quickActions.push(
        <button key="reorder" onClick={() => onReorder(entry)}>
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
        >
          📋 Copy
        </button>,
      );
      quickActions.push(
        <button key="hide-secret" onClick={() => setSecretRevealed(false)}>
          👁 Hide
        </button>,
      );
    }
  }

  // Share always available (but not for secret entries)
  if (!isSecret)
    quickActions.push(
      <button key="share" onClick={handleShare}>
        📤 Share
      </button>,
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={editing ? undefined : onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div>
          <div>
            <div>
              <span>{cfg.i}</span>
              <span>{editType}</span>
            </div>
            {!editing && (
              <h2 id="detail-modal-title">
                {editTitle}
              </h2>
            )}
          </div>
          <div>
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
              >
                {deleting ? "Deleting..." : confirmingDelete ? "Confirm delete?" : "Delete"}
              </button>
            )}
            {!editing && canWrite && onUpdate && (
              <button onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {!canWrite && (
              <span>🔒 View only</span>
            )}
            <button onClick={editing ? () => setEditing(false) : onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Edit form */}
        {editing ? (
          <div>
            <div>
              <label>Title</label>
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div>
              <label>Type</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
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
              <label>Content</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <label>
                Tags{" "}
                <span>(comma separated)</span>
              </label>
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
            </div>
            {brains.length > 1 && (
              <div>
                <label>Brain</label>
                <div>
                  {brains.map((b) => {
                    const emoji = b.type === "family" ? "🏠" : b.type === "business" ? "🏪" : "🧠";
                    const active = editBrainId === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setEditBrainId(b.id)}
                      >
                        {emoji} {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <button onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editTitle.trim()}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {isSecret && !secretRevealed ? (
              <div>
                <div>{vaultUnlocked ? "🔐" : "🔒"}</div>
                <p>
                  {vaultUnlocked
                    ? "This entry is end-to-end encrypted"
                    : "Unlock your Vault to view this secret"}
                </p>
                {vaultUnlocked ? (
                  <button onClick={() => setSecretRevealed(true)}>
                    Reveal content
                  </button>
                ) : (
                  <p>
                    Go to the Vault tab and enter your passphrase
                  </p>
                )}
              </div>
            ) : (
              <>
                <p>{editContent}</p>
                {meta.length > 0 && (
                  <div>
                    {meta.map(([k, v]) => (
                      <div key={k}>
                        <span>
                          {k.replace(/_/g, " ")}:{" "}
                        </span>
                        <span>
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
              <div>
                <div>
                  {editTags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag}>
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            )}
            {related.length > 0 && (
              <div>
                <p>Connections</p>
                {related.map(
                  (r, i) =>
                    r.other && (
                      <div key={i}>
                        <span>{TC[r.other.type]?.i}</span>
                        <span>{r.dir}</span>
                        <span>{r.other.title}</span>
                        <span>{r.rel}</span>
                      </div>
                    ),
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {!editing && quickActions.length > 0 && (
          <div>
            <div>{quickActions}</div>
            {shareMsg && <p>{shareMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
