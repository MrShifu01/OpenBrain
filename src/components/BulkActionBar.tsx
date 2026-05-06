import { useState, useEffect, type JSX } from "react";
import { authFetch } from "../lib/authFetch";
import { CANONICAL_TYPES } from "../types";
import type { Brain, Entry } from "../types";
import { Button } from "./ui/button";
import MergePreviewModal from "./MergePreviewModal";

interface Props {
  selectedIds: Set<string>;
  entries: Entry[];
  brains: Brain[];
  /** Active brain — excluded from the share-target picker since the
   *  selected entries already live there. */
  activeBrainId?: string;
  onDone: (updatedEntries: Entry[]) => void;
  onCancel: () => void;
  onSelectAll?: () => void;
  onDelete?: (ids: string[]) => Promise<void>;
  /** Fired after a successful bulk move so the parent can drop the
   *  moved entries from its local list. */
  onMoved?: (ids: string[]) => void;
  /** Fired after a successful merge so the parent can drop the source
   *  entries from its local list and refresh to show the merged entry. */
  onMerged?: (mergedId: string, sourceIds: string[]) => void;
  allSelected?: boolean;
}

type Phase = "idle" | "typing" | "confirmDelete" | "share" | "move" | "more";

export default function BulkActionBar({
  selectedIds,
  entries,
  brains,
  activeBrainId,
  onDone,
  onCancel,
  onSelectAll,
  onDelete,
  onMoved,
  onMerged,
  allSelected = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [shareTargets, setShareTargets] = useState<Set<string>>(new Set());
  const [shareError, setShareError] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  // Reset phase when the selection changes externally — keeps a stale "Are
  // you sure you want to delete?" from sitting around after the user has
  // already cleared selection.
  useEffect(() => {
    if (selectedIds.size === 0) {
      setPhase("idle");
      setSuggested(null);
      setShareTargets(new Set());
      setShareError(null);
      setMoveTarget(null);
      setMoveError(null);
    }
  }, [selectedIds.size]);

  const shareableBrains = brains.filter((b) => b.id !== activeBrainId);

  const count = selectedIds.size;

  // Merge guard — refuse if any selected entry is vault. Vault contents
  // can't be sent to the LLM (encryption is the whole point) and the
  // server would refuse anyway; this just gives a cleaner UX.
  const selectedEntries = entries.filter((e) => selectedIds.has(e.id));
  const hasVault = selectedEntries.some((e) => e.type === "secret");
  const canMerge = count >= 2 && count <= 8 && !hasVault;

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

  // Share-overlay (migration 070) — the selected entries become visible
  // in every chosen target brain without being moved or duplicated.
  // Idempotent on the server side (Prefer: ignore-duplicates), so re-
  // toggling a target the user already shared into is safe.
  async function bulkShare() {
    if (busy || shareTargets.size === 0) return;
    setBusy(true);
    setShareError(null);
    const ids = [...selectedIds];
    const targets = [...shareTargets];
    let failed = 0;
    for (const id of ids) {
      for (const brainId of targets) {
        try {
          const r = await authFetch(
            `/api/entries?action=share&id=${encodeURIComponent(id)}&brain_id=${encodeURIComponent(brainId)}`,
            { method: "POST", headers: { "Content-Type": "application/json" } },
          );
          if (!r.ok) failed++;
        } catch {
          failed++;
        }
      }
    }
    setBusy(false);
    if (failed > 0) {
      setShareError(`${failed} of ${ids.length * targets.length} shares failed.`);
      return;
    }
    setPhase("idle");
    setShareTargets(new Set());
    onCancel();
  }

  // Bulk move — each selected entry's brain_id changes to the picked
  // target. Concept-graph trim and re-enrichment happen server-side per
  // entry (see api/entries.ts handleMoveEntry). Move differs from share:
  // exactly one target brain, ownership transfers, the entry leaves its
  // source brain.
  async function bulkMove() {
    if (busy || !moveTarget) return;
    setBusy(true);
    setMoveError(null);
    const ids = [...selectedIds];
    let failed = 0;
    for (const id of ids) {
      try {
        const r = await authFetch(
          `/api/entries?action=move&id=${encodeURIComponent(id)}&brain_id=${encodeURIComponent(moveTarget)}`,
          { method: "POST", headers: { "Content-Type": "application/json" } },
        );
        if (!r.ok) failed++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (failed > 0) {
      setMoveError(`${failed} of ${ids.length} moves failed.`);
      return;
    }
    setPhase("idle");
    setMoveTarget(null);
    // Moved entries leave the active brain — let the parent drop them
    // from its local list so the user doesn't see ghosts. onDone's
    // map-by-id semantics can't express removal, so we use a separate
    // signal (onMoved).
    onMoved?.(ids);
    onCancel();
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
        // Hide the action bar while the merge modal is open — the bar's
        // fixed-bottom position otherwise covers the modal's footer
        // (Save/Cancel buttons), confusing the user. Visibility instead
        // of display so the modal's parent doesn't reflow.
        visibility: mergeOpen ? "hidden" : "visible",
        pointerEvents: mergeOpen ? "none" : "auto",
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
            {shareableBrains.length > 0 && (
              <ActionBtn
                label="Share with…"
                tone="moss"
                disabled={busy}
                onClick={() => setPhase("share")}
              />
            )}
            {shareableBrains.length > 0 && (
              <ActionBtn
                label="Move to…"
                tone="ghost"
                disabled={busy}
                onClick={() => setPhase("move")}
              />
            )}
            {onDelete && (
              <ActionBtn
                label={`Delete · ${count}`}
                tone="ghost"
                disabled={busy}
                onClick={() => setPhase("confirmDelete")}
              />
            )}
            {/* More — overflow for less-frequent actions (Merge today,
                future overflow goes here). Hidden when count < 2 since
                merge is the only More action and needs at least 2. */}
            {count >= 2 && (
              <ActionBtn
                label="More"
                tone="ghost"
                disabled={busy}
                onClick={() => setPhase("more")}
              />
            )}
          </div>
        )}

        {phase === "more" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ActionBtn
                label={`Merge · ${count}`}
                tone="ember"
                disabled={busy || !canMerge}
                onClick={() => {
                  if (!canMerge) return;
                  setMergeOpen(true);
                }}
              />
              <ActionBtn
                label="Back"
                tone="ghost"
                disabled={busy}
                onClick={() => setPhase("idle")}
              />
            </div>
            {hasVault && (
              <p className="f-sans" style={{ margin: 0, fontSize: 11, color: "var(--ink-faint)" }}>
                Cannot merge: vault entries can't be processed by the AI.
              </p>
            )}
          </div>
        )}

        {phase === "share" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p className="f-sans" style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>
              Make {count} {count === 1 ? "entry" : "entries"} visible in…
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {shareableBrains.map((b) => {
                const picked = shareTargets.has(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      setShareTargets((prev) => {
                        const next = new Set(prev);
                        if (next.has(b.id)) next.delete(b.id);
                        else next.add(b.id);
                        return next;
                      })
                    }
                    disabled={busy}
                    className="press"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: picked ? "var(--ember-wash)" : "var(--surface)",
                      border: `1px solid ${picked ? "var(--ember)" : "var(--line-soft)"}`,
                      borderRadius: 8,
                      color: "var(--ink)",
                      fontFamily: "var(--f-sans)",
                      fontSize: 12,
                      textAlign: "left",
                      cursor: busy ? "default" : "pointer",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        border: `1.5px solid ${picked ? "var(--ember)" : "var(--line-soft)"}`,
                        background: picked ? "var(--ember)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {picked && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
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
                          fontWeight: 500,
                        }}
                      >
                        {b.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {shareError && (
              <div role="alert" style={{ fontSize: 11, color: "var(--blood)" }}>
                {shareError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPhase("idle");
                  setShareTargets(new Set());
                  setShareError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={bulkShare}
                disabled={busy || shareTargets.size === 0}
              >
                {busy
                  ? "Sharing…"
                  : `Share · ${count} → ${shareTargets.size || 0} brain${shareTargets.size === 1 ? "" : "s"}`}
              </Button>
            </div>
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

        {phase === "move" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p className="f-sans" style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>
              Move {count} {count === 1 ? "entry" : "entries"} to…
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {shareableBrains.map((b) => {
                const picked = moveTarget === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setMoveTarget(picked ? null : b.id)}
                    disabled={busy}
                    className="press"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: picked ? "var(--ember-wash)" : "var(--surface)",
                      border: `1px solid ${picked ? "var(--ember)" : "var(--line-soft)"}`,
                      borderRadius: 8,
                      color: "var(--ink)",
                      fontFamily: "var(--f-sans)",
                      fontSize: 12,
                      textAlign: "left",
                      cursor: busy ? "default" : "pointer",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: `1.5px solid ${picked ? "var(--ember)" : "var(--line-soft)"}`,
                        background: picked ? "var(--ember)" : "transparent",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>{b.name}</div>
                  </button>
                );
              })}
            </div>
            {moveError && (
              <div role="alert" style={{ fontSize: 11, color: "var(--blood)" }}>
                {moveError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPhase("idle");
                  setMoveTarget(null);
                  setMoveError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button size="sm" variant="default" onClick={bulkMove} disabled={busy || !moveTarget}>
                {busy ? "Moving…" : `Move · ${count}`}
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

      {mergeOpen && (
        <MergePreviewModal
          ids={[...selectedIds]}
          onCancel={() => setMergeOpen(false)}
          onCommitted={(mergedId, sourceIds) => {
            setMergeOpen(false);
            setPhase("idle");
            onMerged?.(mergedId, sourceIds);
            onCancel();
          }}
        />
      )}
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
