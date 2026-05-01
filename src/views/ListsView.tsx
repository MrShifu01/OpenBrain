/**
 * ListsView — top-level view for the Lists feature.
 *
 * Index mode: grid of list cards (entries with type="list"), plus a
 * "+ New list" button that opens CreateListPanel.
 *
 * Detail mode: drill into a list, render ListDetail. Driven by local state
 * — no URL routing in v1; the back button returns to index. (URL routing
 * is a v2 polish if data shows users need shareable list links.)
 *
 * Reads entries from useDataLayer (already loaded by the shell — no fresh
 * fetch). Mutations propagate via onEntryUpdate / onEntryDelete callbacks
 * passed from Everion.tsx.
 */
import { useMemo, useState } from "react";
import type { Entry } from "../types";
import CreateListPanel from "../components/CreateListPanel";
import ListDetail from "../components/ListDetail";
import { Button } from "../components/ui/button";
import { authFetch } from "../lib/authFetch";
import { showToast } from "../lib/notifications";

interface ListsViewProps {
  entries: Entry[];
  brainId: string | undefined;
  onEntryCreated: (entry: Entry) => void;
  onEntryUpdate: (entry: Entry) => void;
  onEntryDelete: (entryId: string) => void;
}

export default function ListsView({
  entries,
  brainId,
  onEntryCreated,
  onEntryUpdate,
  onEntryDelete,
}: ListsViewProps) {
  const [creating, setCreating] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // All list-typed entries, newest first (within the current brain — entries
  // are already brain-scoped at the data-layer level).
  const lists = useMemo(
    () =>
      entries
        .filter((e) => e.type === "list" && !e.deleted_at)
        .sort((a, b) => {
          const aT = a.updated_at || a.created_at || "";
          const bT = b.updated_at || b.created_at || "";
          return bT.localeCompare(aT);
        }),
    [entries],
  );

  const activeList = useMemo(
    () => (activeListId ? (lists.find((l) => l.id === activeListId) ?? null) : null),
    [activeListId, lists],
  );

  async function handleDeleteList(entryId: string) {
    try {
      const res = await authFetch("/api/delete-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entryId }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[lists] delete failed", res.status, body);
        showToast("Couldn't delete list — try again", "error");
        return;
      }
      onEntryDelete(entryId);
      setActiveListId(null);
    } catch (e) {
      console.error("[lists] delete exception", e);
      showToast("Couldn't delete list — try again", "error");
    }
  }

  // ── Detail mode ──
  if (activeList) {
    return (
      <ListDetail
        entry={activeList}
        onBack={() => setActiveListId(null)}
        onUpdate={onEntryUpdate}
        onDeleteList={handleDeleteList}
      />
    );
  }

  // ── Index mode ──
  return (
    <div style={{ padding: "20px 16px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1
          className="f-serif"
          style={{
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          lists
        </h1>
        <Button onClick={() => setCreating(true)} disabled={!brainId}>
          + new list
        </Button>
      </div>

      {lists.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--ink-soft)",
          }}
        >
          <div
            className="f-serif"
            style={{
              fontSize: 18,
              fontStyle: "italic",
              marginBottom: 8,
              color: "var(--ink)",
            }}
          >
            no lists yet
          </div>
          <div className="f-sans" style={{ fontSize: 13, color: "var(--ink-faint)" }}>
            paste a list of things to start. groceries, movies to watch, packing list.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {lists.map((list) => (
            <ListCard key={list.id} list={list} onOpen={() => setActiveListId(list.id)} />
          ))}
        </div>
      )}

      {brainId && (
        <CreateListPanel
          brainId={brainId}
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(entry) => {
            onEntryCreated(entry);
            setCreating(false);
            setActiveListId(entry.id);
          }}
        />
      )}
    </div>
  );
}

function ListCard({ list, onOpen }: { list: Entry; onOpen: () => void }) {
  const items = Array.isArray(list.metadata?.items)
    ? (list.metadata!.items as { completed?: boolean }[])
    : [];
  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const allDone = total > 0 && done === total;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="press"
      style={{
        textAlign: "left",
        padding: 16,
        background: "var(--surface)",
        border: `1px solid ${allDone ? "var(--moss, #6b8e6b)" : "var(--line-soft)"}`,
        borderRadius: 12,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transition: "border-color 120ms",
      }}
    >
      <div
        className="f-serif"
        style={{
          fontSize: 16,
          fontWeight: 450,
          color: "var(--ink)",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {list.title}
      </div>
      <div
        className="f-sans"
        style={{
          fontSize: 12,
          color: "var(--ink-soft)",
          fontStyle: "italic",
        }}
      >
        {total === 0
          ? "empty"
          : allDone
            ? `${total} of ${total} done ✓`
            : `${done} of ${total} done`}
      </div>
    </button>
  );
}
