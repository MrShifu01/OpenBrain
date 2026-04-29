import { useState, useEffect } from "react";
import { authFetch } from "../lib/authFetch";
import { CANONICAL_TYPES } from "../types";
import type { Brain, Entry } from "../types";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Cross-brain assignment is gated until shared/community brains lands. Flip
// this back to true when that feature ships — the picker code below is left
// intact so restoring is a single-line change.
const SHARED_BRAINS_ENABLED = false;

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

export default function BulkActionBar({
  selectedIds,
  entries: _entries,
  brains,
  onDone,
  onCancel,
  onSelectAll,
  onDelete,
  allSelected = false,
}: Props) {
  const [targetType, setTargetType] = useState("");
  const [targetBrainIds, setTargetBrainIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Two-tap inline delete: first tap arms the trash button (shows
  // "Tap to confirm"), second tap executes. Auto-reverts after 2.5s.
  // No OS dialog — design philosophy in CLAUDE.md.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Auto-disarm the inline delete confirmation after 2.5s of no follow-up
  // tap. Otherwise an armed trash button could sit there for minutes and
  // surprise the user on their next tap.
  useEffect(() => {
    if (!confirmingDelete) return;
    const t = setTimeout(() => setConfirmingDelete(false), 2500);
    return () => clearTimeout(t);
  }, [confirmingDelete]);

  const count = selectedIds.size;
  const hasAction = !!targetType || targetBrainIds.size > 0;

  async function suggestType() {
    setAiTyping(true);
    try {
      const selected = _entries.filter((e) => selectedIds.has(e.id)).slice(0, 5);
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
        // Find whichever type appears EARLIEST in the response
        const match = types
          .map((t) => ({ t, idx: raw.search(new RegExp(`\\b${t}\\b`)) }))
          .filter((m) => m.idx >= 0)
          .sort((a, b) => a.idx - b.idx)[0]?.t;
        if (match) setTargetType(match);
        else console.warn("[bulkSuggestType] no match, got:", full);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("[bulkSuggestType]", res.status, errData);
      }
    } catch (err: any) {
      console.error("[bulkSuggestType]", err);
    }
    setAiTyping(false);
  }

  function toggleBrain(id: string) {
    setTargetBrainIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete([...selectedIds]);
    setDeleting(false);
    onCancel();
  }

  async function apply() {
    if (!hasAction) return;
    const ids = [...selectedIds];
    const updated: Entry[] = [];
    let done = 0;

    setProgress(`Updating 0 / ${ids.length}…`);

    for (const id of ids) {
      let entryOk = true;

      if (targetType) {
        try {
          const res = await authFetch("/api/update-entry", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, type: targetType }),
          });
          if (res.ok) updated.push(await res.json());
          else entryOk = false;
        } catch (err) {
          console.error("[BulkActionBar] type update failed for entry", id, err);
          entryOk = false;
        }
      }

      for (const brain_id of targetBrainIds) {
        try {
          const res = await authFetch("/api/entry-brains", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entry_id: id, brain_id }),
          });
          if (!res.ok) entryOk = false;
        } catch (err) {
          console.error("[BulkActionBar] brain assignment failed for entry", id, err);
          entryOk = false;
        }
      }

      if (entryOk) done++;
      setProgress(`Updating ${done} / ${ids.length}…`);
    }

    setProgress(null);
    onDone(updated);
  }

  const selectedBrainNames = brains.filter((b) => targetBrainIds.has(b.id)).map((b) => b.name);

  const dropdownContentClass = "max-h-[180px]";

  // Collapsed pill — low-profile chip so selecting more items isn't blocked.
  // Position: sit ~12px above the BottomNav (56px + safe-area-inset-bottom).
  // Hard-coded `bottom-24` = 96px gets eaten by the home indicator on iPhones
  // with a tall safe area, hiding the pill. z-index above BottomNav (50).
  if (!expanded) {
    // While a bulk delete is in flight, replace all controls with a single
    // "Deleting…" indicator so the user sees the action was acknowledged.
    // The pill auto-dismisses (onCancel) once onDelete completes, but if the
    // delete is slow this prevents a "did anything happen?" gap.
    if (deleting) {
      return (
        <div
          className="fixed left-1/2 -translate-x-1/2"
          style={{
            bottom: "calc(68px + env(safe-area-inset-bottom))",
            zIndex: "var(--z-fab)",
            width: "auto",
            maxWidth: "92vw",
          }}
        >
          <div
            className="flex items-center gap-3 rounded-full border py-2.5 pr-5 pl-5 shadow-lg"
            style={{
              background: "var(--color-surface-container-high)",
              borderColor: "var(--color-outline-variant)",
              boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.18))",
            }}
            role="status"
            aria-live="polite"
          >
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              style={{ color: "var(--color-error, var(--blood))" }}
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span
              className="text-xs font-semibold whitespace-nowrap"
              style={{ color: "var(--color-on-surface)" }}
            >
              Deleting {count} {count === 1 ? "entry" : "entries"}…
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed left-1/2 -translate-x-1/2"
        style={{
          bottom: "calc(68px + env(safe-area-inset-bottom))",
          zIndex: "var(--z-fab)",
          width: "auto",
          maxWidth: "92vw",
        }}
      >
        <div
          className="flex items-center gap-2 rounded-full border py-1.5 pr-1.5 pl-4 shadow-lg"
          style={{
            background: "var(--color-surface-container-high)",
            borderColor: "var(--color-outline-variant)",
            boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.18))",
          }}
        >
          <span
            className="text-xs font-semibold whitespace-nowrap"
            style={{ color: "var(--color-on-surface)" }}
          >
            {count} selected
          </span>
          {onSelectAll && (
            <Button size="sm" variant={allSelected ? "default" : "outline"} onClick={onSelectAll}>
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
          )}
          {/* Delete — most-common bulk action surfaced inline so it doesn't
              hide behind the More panel. Confirm before destructive op.
              On success, dismiss the pill — keeping it open after action is
              taken just creates a "what now?" moment for the user. */}
          {onDelete &&
            (confirmingDelete ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={deleting}
                aria-label={`Confirm delete ${count}`}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete(Array.from(selectedIds));
                    onCancel();
                  } finally {
                    setDeleting(false);
                    setConfirmingDelete(false);
                  }
                }}
              >
                Tap to confirm
              </Button>
            ) : (
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={deleting}
                aria-label={`Delete ${count} selected`}
                onClick={() => setConfirmingDelete(true)}
                className="text-[var(--blood,#c44)]"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                  />
                </svg>
              </Button>
            ))}
          <Button size="sm" onClick={() => setExpanded(true)} aria-label="More actions">
            More
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onCancel} aria-label="Cancel selection">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2"
      style={{
        // Match the collapsed pill's clearance from BottomNav.
        bottom: "calc(68px + env(safe-area-inset-bottom))",
        zIndex: "var(--z-fab)",
        width: "min(92vw, 480px)",
      }}
    >
      <div
        className="flex flex-col gap-3 rounded-2xl border p-4 shadow-lg"
        style={{
          background: "var(--color-surface-container-high)",
          borderColor: "var(--color-outline-variant)",
          boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.18))",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(false)}
            aria-label="Back to selecting"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {count} {count === 1 ? "entry" : "entries"} selected
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {/* Type picker — opens upward */}
          <div className="relative flex flex-1 flex-col gap-1">
            <div className="flex items-center justify-between">
              <label
                className="text-[11px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Change type
              </label>
              <button
                type="button"
                onClick={suggestType}
                disabled={aiTyping}
                className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold transition-all disabled:opacity-50"
                style={{
                  background: "var(--color-primary-container)",
                  color: "var(--color-primary)",
                }}
              >
                {aiTyping ? "…" : "✦ AI"}
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex w-full items-center justify-between rounded-xl border bg-transparent px-2.5 py-1.5 text-left text-xs outline-none"
                style={{
                  borderColor: "var(--color-outline-variant)",
                  color: "var(--color-on-surface)",
                }}
              >
                <span className="truncate">
                  {targetType
                    ? targetType.charAt(0).toUpperCase() + targetType.slice(1)
                    : "— keep —"}
                </span>
                <svg
                  className="h-3 w-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className={dropdownContentClass}>
                <DropdownMenuItem onSelect={() => setTargetType("")}>— keep —</DropdownMenuItem>
                {CANONICAL_TYPES.map((t) => (
                  <DropdownMenuItem
                    key={t}
                    onSelect={() => setTargetType(t)}
                    style={{
                      background: targetType === t ? "var(--color-primary-container)" : undefined,
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Brain multi-picker — hidden until shared brains ships. */}
          {SHARED_BRAINS_ENABLED && (
            <div className="relative flex flex-1 flex-col gap-1">
              <label
                className="text-[11px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--color-on-surface-variant)" }}
              >
                Add to brains
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex w-full items-center justify-between rounded-xl border bg-transparent px-2.5 py-1.5 text-left text-xs outline-none"
                  style={{
                    borderColor: "var(--color-outline-variant)",
                    color: "var(--color-on-surface)",
                  }}
                >
                  <span className="truncate">
                    {targetBrainIds.size === 0 ? "— none —" : selectedBrainNames.join(", ")}
                  </span>
                  <svg
                    className="h-3 w-3 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className={dropdownContentClass}>
                  {brains.map((b) => (
                    <DropdownMenuCheckboxItem
                      key={b.id}
                      checked={targetBrainIds.has(b.id)}
                      onCheckedChange={() => toggleBrain(b.id)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {b.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Apply */}
        <Button onClick={apply} disabled={!hasAction || !!progress || deleting} className="w-full">
          {progress ?? `Apply to ${count} ${count === 1 ? "entry" : "entries"}`}
        </Button>

        {/* Destructive actions */}
        {onDelete && (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={bulkDelete}
              disabled={deleting || !!progress}
              className="flex-1"
            >
              {deleting ? "Deleting…" : `Delete ${count}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
