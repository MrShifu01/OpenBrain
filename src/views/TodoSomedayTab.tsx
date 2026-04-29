import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { format } from "date-fns";
import { authFetch } from "../lib/authFetch";
import type { Entry } from "../types";
import { isDone } from "./todoUtils";

// GTD Someday/Maybe inbox.
//
// Shows incomplete `type="someday"` entries — newest first. Each row offers
// three actions: Done (mark completed), Schedule (date picker → flip to
// type="todo" with metadata.due_date so the existing Calendar tab picks it
// up), and Drop (soft-delete). Quick-add at the top stores raw text directly
// as a someday entry, no AI parsing — feels like jotting on a Post-it.
//
// Categories: the user creates and manages categories explicitly. Each
// category is just a tag, but we persist the *list* in localStorage so empty
// categories survive (you can create a bucket before adding anything to it),
// and we expose Rename / Delete on each chip. Renaming bulk-updates every
// someday entry that carries the tag. The quick-add auto-tags new items
// with the active filter; each row has an inline "Move to…" picker so you
// can rebucket without leaving the tab.
//
// Gated behind the `someday` power feature in Everion.tsx; the parent
// TodoView only mounts this when the flag is on.

const ALL = "__all__";
const UNTAGGED = "__untagged__";

// Tag we always strip from category chips. Every bulk-imported launch entry
// has it as a marker, but it's not useful as a filter — every item would
// have it, so it adds no signal.
const HIDDEN_CATEGORY_TAGS = new Set(["launch"]);

// Categories live on the brain (server-side, JSONB column) so they sync
// across devices. localStorage acts as an optimistic cache so the chips
// render instantly on every load and writes don't block the UI.
const userCatsKey = (brainId: string | undefined) =>
  brainId ? `everion.someday.categories.${brainId}` : "everion.someday.categories.default";

function readCachedCategories(brainId: string | undefined): string[] {
  try {
    const raw = localStorage.getItem(userCatsKey(brainId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string" && s.trim()) : [];
  } catch {
    return [];
  }
}

function writeCachedCategories(brainId: string | undefined, list: string[]) {
  try {
    localStorage.setItem(userCatsKey(brainId), JSON.stringify(list));
  } catch {
    /* quota or disabled — ignore */
  }
}

// Pull the current category list from the brain row. Returns null on any
// failure so the caller can fall back to the local cache.
async function fetchBrainCategories(brainId: string): Promise<string[] | null> {
  try {
    const res = await authFetch("/api/brains");
    if (!res.ok) return null;
    const brains: Array<{ id: string; metadata?: { someday_categories?: unknown } }> =
      await res.json();
    const brain = brains.find((b) => b.id === brainId);
    const list = brain?.metadata?.someday_categories;
    if (!Array.isArray(list)) return [];
    return list.filter((s): s is string => typeof s === "string" && !!s.trim());
  } catch {
    return null;
  }
}

async function pushBrainCategories(brainId: string, list: string[]): Promise<void> {
  try {
    await authFetch("/api/brains", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: brainId, metadata: { someday_categories: list } }),
    });
  } catch (err) {
    console.error("[someday-cats-sync]", err);
  }
}

interface Props {
  entries: Entry[];
  brainId?: string;
  onAdded: () => void;
  onUpdate?: (id: string, changes: Partial<Entry>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

export default function TodoSomedayTab({
  entries,
  brainId,
  onAdded,
  onUpdate,
  onDelete,
}: Props): JSX.Element {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>(ALL);

  // User-defined category list. Optimistic flow:
  //   1. Render from localStorage cache immediately (no flicker).
  //   2. Fetch from brain on mount; if server has newer/different list,
  //      adopt it and update the cache.
  //   3. Every mutation writes localStorage synchronously and PATCHes the
  //      brain in the background.
  const [userCategories, setUserCategories] = useState<string[]>(() =>
    readCachedCategories(brainId),
  );
  useEffect(() => {
    setUserCategories(readCachedCategories(brainId));
    if (!brainId) return;
    let cancelled = false;
    fetchBrainCategories(brainId).then((server) => {
      if (cancelled || !server) return;
      const cached = readCachedCategories(brainId);
      // Server is authoritative; merge cache only if server is empty (covers
      // first-ever sync after upgrading from local-only).
      const next = server.length === 0 && cached.length > 0 ? cached : server;
      setUserCategories(next);
      writeCachedCategories(brainId, next);
      // Backfill server if it had nothing and cache had local categories.
      if (server.length === 0 && cached.length > 0) {
        pushBrainCategories(brainId, cached);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [brainId]);
  const persistUserCategories = (next: string[]) => {
    const cleaned = Array.from(new Set(next.map((s) => s.trim()).filter(Boolean)));
    setUserCategories(cleaned);
    writeCachedCategories(brainId, cleaned);
    if (brainId) pushBrainCategories(brainId, cleaned);
  };

  const allItems = useMemo(
    () =>
      entries
        .filter((e) => e.type === "someday" && !isDone(e))
        .sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        ),
    [entries],
  );

  // Category list: union of (a) tags currently in use across someday items
  // and (b) user-declared categories — so a freshly-created empty bucket
  // still shows up. Counts come from items only.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of allItems) {
      for (const raw of e.tags ?? []) {
        const tag = raw.trim();
        if (!tag) continue;
        if (HIDDEN_CATEGORY_TAGS.has(tag)) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    for (const tag of userCategories) {
      if (!counts.has(tag)) counts.set(tag, 0);
    }
    return [...counts.entries()]
      .map(([tag, n]) => ({ tag, n }))
      .sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
  }, [allItems, userCategories]);

  const untaggedCount = useMemo(
    () =>
      allItems.filter((e) =>
        (e.tags ?? []).every((t) => !t.trim() || HIDDEN_CATEGORY_TAGS.has(t.trim())),
      ).length,
    [allItems],
  );

  const items = useMemo(() => {
    if (selectedTag === ALL) return allItems;
    if (selectedTag === UNTAGGED) {
      return allItems.filter((e) =>
        (e.tags ?? []).every((t) => !t.trim() || HIDDEN_CATEGORY_TAGS.has(t.trim())),
      );
    }
    return allItems.filter((e) => (e.tags ?? []).some((t) => t.trim() === selectedTag));
  }, [allItems, selectedTag]);

  const completedItems = useMemo(
    () =>
      entries
        .filter((e) => e.type === "someday" && isDone(e))
        .sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        ),
    [entries],
  );

  // All known category tags for inline rebucketing dropdown (no hidden tags).
  const knownTags = useMemo(() => categories.map((c) => c.tag), [categories]);

  const createCategory = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    if (HIDDEN_CATEGORY_TAGS.has(name)) return;
    if (userCategories.includes(name) || knownTags.includes(name)) {
      setSelectedTag(name);
      return;
    }
    persistUserCategories([...userCategories, name]);
    setSelectedTag(name);
  };

  const renameCategory = async (oldName: string, newRaw: string) => {
    const newName = newRaw.trim();
    if (!newName || newName === oldName) return;
    if (HIDDEN_CATEGORY_TAGS.has(newName)) return;
    // Bulk-update every someday entry carrying the old tag.
    const affected = allItems.filter((e) => (e.tags ?? []).some((t) => t.trim() === oldName));
    for (const entry of affected) {
      const next = (entry.tags ?? []).map((t) => (t.trim() === oldName ? newName : t));
      try {
        await onUpdate?.(entry.id, { tags: next });
      } catch (err) {
        console.error("[someday-rename]", err);
      }
    }
    // Persist in user list too (covers empty buckets).
    persistUserCategories(
      userCategories.map((t) => (t === oldName ? newName : t)).filter((t) => t !== ""),
    );
    if (selectedTag === oldName) setSelectedTag(newName);
  };

  const deleteCategory = async (name: string) => {
    // Strip the tag from every someday entry that has it. Items themselves
    // are kept — they just become untagged (or keep other tags).
    //
    // Per-entry tag arrays differ, so we group by next-tag-set and fire one
    // bulk PATCH per group. In practice almost every affected row ends up
    // with the same `tags` after the strip (only rows with extra unique
    // tags differ), so this collapses to ~1-3 round-trips for any
    // realistic pile size — vs the old per-entry loop that 429'd at 30
    // affected rows.
    const affected = allItems.filter((e) => (e.tags ?? []).some((t) => t.trim() === name));
    const groups = new Map<string, { tags: string[]; ids: string[] }>();
    for (const entry of affected) {
      const next = (entry.tags ?? []).filter((t) => t.trim() !== name);
      const key = JSON.stringify(next);
      const group = groups.get(key);
      if (group) group.ids.push(entry.id);
      else groups.set(key, { tags: next, ids: [entry.id] });
    }
    // Optimistic UI: caller (Everion) already wired onUpdate to update
    // local state per-entry. We bypass it for the bulk path and POST
    // straight to the server — but we still mirror the local-state
    // update so the chip count drops immediately. The next entries
    // refetch picks up the canonical state.
    await Promise.all(
      Array.from(groups.values()).map(async (group) => {
        try {
          const r = await authFetch("/api/entries?action=bulk-patch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: group.ids, patch: { tags: group.tags } }),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          // Mirror to local state so the UI reflects the change without a
          // full refetch.
          for (const id of group.ids) {
            await onUpdate?.(id, { tags: group.tags });
          }
        } catch (err) {
          console.error("[someday-delete-cat:bulk]", err);
        }
      }),
    );
    persistUserCategories(userCategories.filter((t) => t !== name));
    if (selectedTag === name) setSelectedTag(ALL);
  };

  const recategorise = async (entry: Entry, newTag: string) => {
    // Strip every existing *known* category tag, keep hidden tags + free-form
    // tags that aren't categories. Add the new one unless moving to untagged.
    const filtered = (entry.tags ?? []).filter((raw) => {
      const t = raw.trim();
      if (!t) return false;
      if (HIDDEN_CATEGORY_TAGS.has(t)) return true;
      return !knownTags.includes(t);
    });
    const next = newTag === UNTAGGED ? filtered : [...filtered, newTag];
    setBusyId(entry.id);
    try {
      await onUpdate?.(entry.id, { tags: next });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 16,
          padding: 16,
          boxShadow: "var(--lift-1)",
        }}
      >
        <SomedayQuickAdd
          brainId={brainId}
          onAdded={onAdded}
          activeTag={selectedTag !== ALL && selectedTag !== UNTAGGED ? selectedTag : ""}
        />
      </div>

      <CategoryChips
        all={allItems.length}
        untagged={untaggedCount}
        categories={categories}
        selected={selectedTag}
        onSelect={setSelectedTag}
        onCreate={createCategory}
        onRename={renameCategory}
        onDelete={deleteCategory}
      />

      {items.length === 0 ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 16,
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>∞</div>
          <p
            className="f-serif"
            style={{
              fontSize: 16,
              fontStyle: "italic",
              color: "var(--ink-soft)",
              margin: "0 0 6px",
            }}
          >
            {selectedTag === ALL
              ? "Someday is empty."
              : selectedTag === UNTAGGED
                ? "Nothing untagged."
                : `No items in “${selectedTag}”.`}
          </p>
          <p
            className="f-sans"
            style={{ fontSize: 13, color: "var(--ink-faint)", margin: 0, lineHeight: 1.5 }}
          >
            Capture anything that's not for today. When the week's planned, pull from here.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {items.map((entry, idx) => (
            <SomedayRow
              key={entry.id}
              entry={entry}
              last={idx === items.length - 1}
              busy={busyId === entry.id}
              scheduling={scheduleId === entry.id}
              knownTags={knownTags}
              onRecategorise={(t) => recategorise(entry, t)}
              onStartSchedule={() => setScheduleId(entry.id)}
              onCancelSchedule={() => setScheduleId(null)}
              onSchedule={async (dateStr) => {
                setBusyId(entry.id);
                setScheduleId(null);
                try {
                  await onUpdate?.(entry.id, {
                    type: "todo",
                    metadata: {
                      ...(entry.metadata || {}),
                      // Canonical Phase 2 field; legacy due_date mirrored for
                      // any callers still reading it.
                      scheduled_for: dateStr,
                      due_date: dateStr,
                      status: "todo",
                    },
                  });
                } finally {
                  setBusyId(null);
                }
              }}
              onDone={async () => {
                setBusyId(entry.id);
                try {
                  await onUpdate?.(entry.id, {
                    metadata: { ...(entry.metadata || {}), status: "done" },
                  });
                } finally {
                  setBusyId(null);
                }
              }}
              onDrop={async () => {
                setBusyId(entry.id);
                try {
                  await onDelete?.(entry.id);
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
        </div>
      )}

      {completedItems.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 16,
            padding: "12px 16px",
          }}
        >
          <p
            className="f-sans"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              margin: "0 0 6px",
            }}
          >
            Recently done · {completedItems.length}
          </p>
          {completedItems.slice(0, 5).map((e) => (
            <p
              key={e.id}
              className="f-serif"
              style={{
                margin: "4px 0",
                fontSize: 13,
                color: "var(--ink-ghost)",
                textDecoration: "line-through",
              }}
            >
              {e.title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChips({
  all,
  untagged,
  categories,
  selected,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  all: number;
  untagged: number;
  categories: { tag: string; n: number }[];
  selected: string;
  onSelect: (tag: string) => void;
  onCreate: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}): JSX.Element {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const submitNew = () => {
    const name = draft.trim();
    if (!name) {
      setAdding(false);
      setDraft("");
      return;
    }
    onCreate(name);
    setDraft("");
    setAdding(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
      }}
    >
      <Chip label={`All · ${all}`} active={selected === ALL} onClick={() => onSelect(ALL)} />
      {untagged > 0 && (
        <Chip
          label={`Untagged · ${untagged}`}
          active={selected === UNTAGGED}
          onClick={() => onSelect(UNTAGGED)}
        />
      )}
      {categories.map((c) => (
        <ChipWithMenu
          key={c.tag}
          tag={c.tag}
          count={c.n}
          active={selected === c.tag}
          menuOpen={menuFor === c.tag}
          onSelect={() => onSelect(c.tag)}
          onOpenMenu={() => setMenuFor(menuFor === c.tag ? null : c.tag)}
          onCloseMenu={() => setMenuFor(null)}
          onRename={(newName) => {
            onRename(c.tag, newName);
            setMenuFor(null);
          }}
          onDelete={() => {
            onDelete(c.tag);
            setMenuFor(null);
          }}
        />
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submitNew}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNew();
            } else if (e.key === "Escape") {
              setAdding(false);
              setDraft("");
            }
          }}
          placeholder="New category…"
          className="f-sans"
          style={{
            height: 28,
            padding: "0 10px",
            fontSize: 12,
            border: "1px dashed var(--ember)",
            borderRadius: 999,
            background: "var(--surface-low)",
            color: "var(--ink)",
            outline: 0,
            minWidth: 120,
          }}
        />
      ) : (
        <Chip label="+ New" onClick={() => setAdding(true)} dashed />
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  dashed,
  onClick,
}: {
  label: string;
  active?: boolean;
  dashed?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="press f-sans"
      style={{
        height: 28,
        padding: "0 12px",
        fontSize: 12,
        fontWeight: 600,
        border: dashed
          ? "1px dashed var(--line)"
          : active
            ? "1px solid var(--ember)"
            : "1px solid var(--line-soft)",
        borderRadius: 999,
        background: active ? "var(--ember)" : "var(--surface)",
        color: active ? "var(--ember-ink)" : "var(--ink-soft)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function ChipWithMenu({
  tag,
  count,
  active,
  menuOpen,
  onSelect,
  onOpenMenu,
  onCloseMenu,
  onRename,
  onDelete,
}: {
  tag: string;
  count: number;
  active: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}): JSX.Element {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(tag);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      setConfirmingDelete(false);
      setRenaming(false);
    }
  }, [menuOpen]);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={onSelect}
        className="press f-sans"
        style={{
          height: 28,
          padding: "0 8px 0 12px",
          fontSize: 12,
          fontWeight: 600,
          border: active ? "1px solid var(--ember)" : "1px solid var(--line-soft)",
          borderRight: "none",
          borderRadius: "999px 0 0 999px",
          background: active ? "var(--ember)" : "var(--surface)",
          color: active ? "var(--ember-ink)" : "var(--ink-soft)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {tag} · {count}
      </button>
      <button
        onClick={onOpenMenu}
        aria-label={`Edit category ${tag}`}
        className="press f-sans"
        style={{
          height: 28,
          padding: "0 8px",
          fontSize: 12,
          border: active ? "1px solid var(--ember)" : "1px solid var(--line-soft)",
          borderRadius: "0 999px 999px 0",
          background: active ? "var(--ember)" : "var(--surface)",
          color: active ? "var(--ember-ink)" : "var(--ink-faint)",
          cursor: "pointer",
        }}
      >
        ⋯
      </button>
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 0,
            zIndex: 20,
            minWidth: 200,
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            boxShadow: "var(--lift-2)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {renaming ? (
            <div style={{ display: "flex", gap: 4, padding: 4 }}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onRename(draft);
                    setRenaming(false);
                  } else if (e.key === "Escape") {
                    setRenaming(false);
                    setDraft(tag);
                  }
                }}
                className="f-sans"
                style={{
                  flex: 1,
                  height: 26,
                  padding: "0 8px",
                  fontSize: 12,
                  border: "1px solid var(--line-soft)",
                  borderRadius: 6,
                  background: "var(--surface-low)",
                  color: "var(--ink)",
                  outline: 0,
                }}
              />
              <button
                onClick={() => {
                  onRename(draft);
                  setRenaming(false);
                }}
                className="press f-sans"
                style={{
                  height: 26,
                  padding: "0 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  background: "var(--moss, #4caf50)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          ) : confirmingDelete ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 6 }}>
              <p
                className="f-sans"
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "var(--ink)",
                }}
              >
                Delete category <span style={{ fontWeight: 600 }}>“{tag}”</span>? Items keep their
                other tags but lose this one.
              </p>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="press f-sans"
                  style={{
                    height: 26,
                    padding: "0 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "1px solid var(--line-soft)",
                    borderRadius: 999,
                    background: "var(--surface)",
                    color: "var(--ink-soft)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete();
                  }}
                  className="press f-sans"
                  style={{
                    height: 26,
                    padding: "0 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    borderRadius: 999,
                    background: "var(--danger, #c44)",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem label="Rename" onClick={() => setRenaming(true)} />
              <MenuItem
                label="Delete category"
                tone="danger"
                onClick={() => setConfirmingDelete(true)}
              />
              <MenuItem label="Close" onClick={onCloseMenu} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger";
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="press f-sans"
      style={{
        textAlign: "left",
        padding: "6px 10px",
        fontSize: 12,
        background: "transparent",
        border: "none",
        borderRadius: 6,
        color: tone === "danger" ? "var(--danger, #c44)" : "var(--ink)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function SomedayRow({
  entry,
  last,
  busy,
  scheduling,
  knownTags,
  onRecategorise,
  onStartSchedule,
  onCancelSchedule,
  onSchedule,
  onDone,
  onDrop,
}: {
  entry: Entry;
  last: boolean;
  busy: boolean;
  scheduling: boolean;
  knownTags: string[];
  onRecategorise: (newTag: string) => void;
  onStartSchedule: () => void;
  onCancelSchedule: () => void;
  onSchedule: (dateStr: string) => void;
  onDone: () => void;
  onDrop: () => void;
}): JSX.Element {
  // Captured once at mount so React Compiler can treat the row as pure;
  // age stamps don't need second-by-second precision.
  const [now] = useState(() => Date.now());
  const ageDays = entry.created_at
    ? Math.floor((now - new Date(entry.created_at).getTime()) / 86_400_000)
    : null;

  // The row's *current* category — first known tag, ignoring hidden ones.
  const currentTag = (entry.tags ?? [])
    .map((t) => t.trim())
    .find((t) => t && !HIDDEN_CATEGORY_TAGS.has(t) && knownTags.includes(t));

  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        opacity: busy ? 0.5 : 1,
        transition: "opacity 200ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--ember)",
            flexShrink: 0,
            marginTop: 8,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="f-serif"
            style={{
              margin: 0,
              fontSize: 15,
              color: "var(--ink)",
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {entry.title}
          </p>
          {entry.content && entry.content !== entry.title && (
            <p
              className="f-sans"
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "var(--ink-faint)",
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              {entry.content.length > 240 ? entry.content.slice(0, 237) + "…" : entry.content}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            {ageDays !== null && (
              <span className="f-sans" style={{ fontSize: 11, color: "var(--ink-ghost)" }}>
                {ageDays === 0 ? "Today" : ageDays === 1 ? "Yesterday" : `${ageDays} days ago`}
              </span>
            )}
            <select
              value={currentTag ?? UNTAGGED}
              disabled={busy}
              onChange={(e) => onRecategorise(e.target.value)}
              className="press f-sans"
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                height: 28,
                padding: "0 28px 0 12px",
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid var(--line-soft)",
                borderRadius: 999,
                background: "var(--surface)",
                color: "var(--ink-soft)",
                cursor: busy ? "not-allowed" : "pointer",
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='none' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M1 1l4 4 4-4'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                outline: 0,
              }}
            >
              <option value={UNTAGGED}>Untagged</option>
              {knownTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {scheduling ? (
        <ScheduleInline onConfirm={onSchedule} onCancel={onCancelSchedule} />
      ) : (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <SmallBtn label="Done" onClick={onDone} disabled={busy} tone="moss" />
          <SmallBtn label="Schedule" onClick={onStartSchedule} disabled={busy} tone="ember" />
          <SmallBtn label="Drop" onClick={onDrop} disabled={busy} tone="ghost" />
        </div>
      )}
    </div>
  );
}

function SmallBtn({
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
  const palettes = {
    ember: { bg: "var(--ember)", fg: "var(--ember-ink)" },
    moss: { bg: "var(--moss, #4caf50)", fg: "#fff" },
    ghost: { bg: "transparent", fg: "var(--ink-faint)" },
  } as const;
  const p = palettes[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press f-sans"
      style={{
        background: p.bg,
        color: p.fg,
        border: tone === "ghost" ? "1px solid var(--line-soft)" : "none",
        borderRadius: 8,
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function ScheduleInline({
  onConfirm,
  onCancel,
}: {
  onConfirm: (dateStr: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextMon = new Date(today);
  const dow = today.getDay();
  const daysToMonday = dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow;
  nextMon.setDate(today.getDate() + daysToMonday);
  const [picked, setPicked] = useState(todayStr);

  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
      }}
    >
      <SmallBtn label="Today" tone="ember" onClick={() => onConfirm(todayStr)} />
      <SmallBtn
        label="Tomorrow"
        tone="ember"
        onClick={() => onConfirm(format(tomorrow, "yyyy-MM-dd"))}
      />
      <SmallBtn
        label="Next Mon"
        tone="ember"
        onClick={() => onConfirm(format(nextMon, "yyyy-MM-dd"))}
      />
      <input
        type="date"
        value={picked}
        onChange={(e) => setPicked(e.target.value)}
        className="f-sans"
        style={{
          height: 30,
          padding: "0 8px",
          fontSize: 12,
          border: "1px solid var(--line-soft)",
          borderRadius: 8,
          background: "var(--surface-low)",
          color: "var(--ink)",
        }}
      />
      <SmallBtn label="Set" tone="moss" onClick={() => onConfirm(picked)} />
      <SmallBtn label="Cancel" tone="ghost" onClick={onCancel} />
    </div>
  );
}

function SomedayQuickAdd({
  brainId,
  onAdded,
  activeTag,
}: {
  brainId?: string;
  onAdded: () => void;
  activeTag?: string;
}): JSX.Element {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = text.trim();
    if (!raw || !brainId || busy) return;
    setBusy(true);
    const title = raw.length > 60 ? raw.slice(0, 57) + "…" : raw;
    const tags = activeTag ? [activeTag] : [];
    try {
      await authFetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_title: title,
          p_content: raw,
          p_type: "someday",
          p_brain_id: brainId,
          p_metadata: {},
          p_tags: tags,
        }),
      });
    } catch (err) {
      console.error("[someday-quick-add]", err);
    } finally {
      setText("");
      setBusy(false);
      onAdded();
      const el = ref.current;
      if (el) el.style.height = "auto";
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--surface-low)",
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        padding: "8px 12px",
      }}
    >
      <span style={{ fontSize: 18, color: "var(--ember)", flexShrink: 0 }}>∞</span>
      <textarea
        ref={ref}
        value={text}
        rows={1}
        onChange={(e) => {
          setText(e.target.value);
          autoResize();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit(e as React.FormEvent);
          }
        }}
        placeholder={
          activeTag
            ? `Add to “${activeTag}” — no date needed…`
            : "Something for someday — no date needed…"
        }
        disabled={busy}
        className="f-sans"
        style={{
          flex: 1,
          background: "transparent",
          border: 0,
          outline: 0,
          resize: "none",
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--ink)",
          padding: 0,
        }}
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="press f-sans"
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          background: "var(--ember)",
          color: "var(--ember-ink)",
          border: "none",
          cursor: busy || !text.trim() ? "not-allowed" : "pointer",
          opacity: busy || !text.trim() ? 0.4 : 1,
        }}
      >
        {busy ? "…" : "Add"}
      </button>
    </form>
  );
}
