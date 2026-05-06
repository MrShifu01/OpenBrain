# Lists v1 — paste-driven checklists with reorder/edit/delete

**Goal:** a top-level "Lists" view where the user can paste a list (Markdown bullets, plain lines, CSV col-1, or future-phase Word/PDF/Excel extracts) and immediately get a working checklist. Items can be added, edited inline, marked complete, reordered, and deleted. Behind feature flag `VITE_FEATURE_LISTS`, default OFF in prod.

This is **not** the AI capture pipeline. List parsing is deterministic — no classification, no enrichment, no embeddings. The parser handles bullets/numbers/plain-lines and that's it.

---

## Why a separate primitive

Lists are checklists. Entries are pieces of memory. They look adjacent but the operations are different:

| Operation | Entry (existing) | List item (new) |
| --------- | ---------------- | --------------- |
| Capture | AI classify + parse + enrich + embed | Just split text → titles |
| Display | Cards in Memory grid, sorted by recency | Rows inside a list, sorted by user-set order |
| Edit | Open DetailModal, edit content + metadata | Inline title edit |
| Delete | Soft delete with undo | Remove from `metadata.items` array |
| Search | Vector embedding + concept graph | (v2) — surface via parent list's content |
| Mutate position | N/A (recency only) | Reorder up/down |
| Mark done | (status field, rarely used) | Checkbox toggle, strike-through |

Mashing both into the entry pipeline would dilute both. Keep entries → memory recall; lists → checklist ergonomics.

---

## Data model

### Persistence

A list = one row in `entries`:
- `type = "list"` (added to `CANONICAL_TYPES` so the type icon system + AI know it)
- `title` = list name ("Groceries", "Movies to watch")
- `content` = optional list description (plain text), used for chat retrieval — gets the parent list embedded so chat can find it
- `metadata.items` = array of items (see below)
- `metadata.list_order` = optional sort hint for the index view (e.g., user pins a list to top)

Items array shape:
```ts
type ListItem = {
  id: string;          // crypto.randomUUID() — local, not persisted to a separate table
  title: string;       // the item text
  completed: boolean;  // checkbox state
  order: number;       // explicit int for reorder; rewrite all on reorder so gaps don't accumulate
};
```

`metadata.items` is the single source of truth. No separate `list_items` table. Reorder/edit/delete = read array, mutate, write back via `PATCH /api/update-entry`. **Atomic at the entry-row level.**

### Why no separate table

- No new migration needed (CHECK constraint on `entries.type` does not exist; type is freeform).
- No 13th Vercel function — reuses `/api/update-entry` via the existing `entries` rewrite.
- Items don't pollute the Memory grid (it groups by entry, and a list is one entry).
- Chat-aware "for free": the list's `content` field includes the item titles so existing embedding picks them up.

### Why no per-item embedding

A grocery item ("milk") has near-zero retrieval value as an isolated vector. The list ITSELF ("groceries — milk, eggs, bread") is the unit chat cares about. We embed the parent list once; items get found via the parent's surface area.

If retention data shows users actually want "find me the entry that mentions milk" cross-list search → per-item embedding is a v2 add (see BRAINSTORM).

---

## Feature flag

`VITE_FEATURE_LISTS` boolean, OFF by default in prod. ON in `.env.local` for dogfooding.

Same shape as the rest of `featureFlags.ts`:

```ts
lists: {
  label: "Lists",
  icon: "≡",
  prodEnabled: import.meta.env.VITE_FEATURE_LISTS === "true",
},
```

Auto-handled by the recently-flag-aware nav (BottomNav, MobileMoreMenu, DesktopSidebar). Per-user admin override via `setAdminFlag("lists", true)` for pre-launch testing.

---

## Files

### New

| Path | Purpose | LOC budget |
| ---- | ------- | ---------- |
| `src/views/ListsView.tsx` | Top-level view: index of lists + drill-in shell | ~250 |
| `src/components/ListDetail.tsx` | Single-list view with checklist UI + ops | ~300 |
| `src/components/CreateListPanel.tsx` | New-list creation panel (title + optional paste) | ~150 |
| `src/lib/listParser.ts` | Pure text → `ListItem[]` parser (no AI) | ~80 |
| `src/lib/__tests__/listParser.test.ts` | Parser contract tests | ~100 |
| `EML/Working/spec-lists-v1.md` | This doc | — |

### Edited

| Path | Change |
| ---- | ------ |
| `src/lib/featureFlags.ts` | Add `lists` entry |
| `src/types.ts` | Add `"list"` to `CANONICAL_TYPES` |
| `src/Everion.tsx` | Add `{id:"lists",l:"Lists"}` to `NAV_VIEWS`; render `<ListsView/>` in view switch |
| `src/components/icons/NavIcons.tsx` | Add `lists` icon (use `≡` glyph or a clean SVG) |
| `src/components/MobileMoreMenu.tsx` | Add Lists to `ALL_ITEMS` with `flag:"lists"` |
| `src/components/__tests__/MobileMoreMenu.test.tsx` | Update `ALL_ON` constant |
| `EML/BRAINSTORM.md` | Add v2 items (per-item embed, vault-encrypted lists, templates, file upload, AI prose split) |

---

## Parser contract (`src/lib/listParser.ts`)

```ts
export interface ListItem {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

/**
 * Pure text → list items. No AI, no network, no side effects.
 *
 * Handles:
 *   - Markdown bullets:  `- foo`, `* foo`, `+ foo`, `• foo`
 *   - Numbered:          `1. foo`, `1) foo`, `(1) foo`
 *   - Checkboxes:        `[ ] foo`, `[x] foo` (preserves completed state)
 *   - Plain lines:       `foo\nbar\nbaz`
 *   - CSV col-1:         `foo,extra,extra` → `foo` (strips quotes)
 *
 * Trims whitespace, skips empty lines, preserves duplicates (user may want
 * "milk x2"). Returns up to MAX_ITEMS_PER_PARSE = 500 — anything over is
 * truncated with a console.warn (UI shows a soft warning).
 */
export function parseListText(raw: string): ListItem[];

export const MAX_ITEMS_PER_PARSE = 500;
```

### Parser test cases

| Input | Expected items |
| ----- | -------------- |
| `"milk\neggs\nbread"` | `["milk", "eggs", "bread"]` |
| `"- milk\n- eggs"` | `["milk", "eggs"]` |
| `"* milk\n+ eggs\n• bread"` | `["milk", "eggs", "bread"]` |
| `"1. milk\n2. eggs"` | `["milk", "eggs"]` |
| `"[ ] milk\n[x] eggs"` | `[{title:"milk",completed:false},{title:"eggs",completed:true}]` |
| `"milk,2L,fridge\neggs,dozen"` | `["milk", "eggs"]` (CSV col-1) |
| `"   foo  \n\n  bar  \n   "` | `["foo", "bar"]` (trims, skips blanks) |
| `""` | `[]` |
| `"foo"` | `["foo"]` |

Parser does NOT handle prose ("here are some things to buy: milk, eggs, bread"). That's a v2 AI-split feature.

---

## API surface

No new endpoints. Reuses:
- `POST /api/capture` to create the parent list entry (same as creating any entry of `type: "list"`).
- `POST /api/update-entry` (rewrite of `/api/entries`) for all mutations on `metadata.items` — add/edit/check/reorder/delete all become a single PATCH with the whole new array.
- `POST /api/delete-entry` to delete a list (same as deleting any entry).

Optimistic updates: client mutates local state immediately, server PATCH happens in background. Failure → toast + revert.

---

## UX flows

### Index (ListsView at top level)

```
┌─────────────────────────────────────────────────────┐
│  Lists                                  [+ New list] │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │ Groceries        │  │ Movies to watch  │        │
│  │ ────             │  │ ────             │        │
│  │ 4 of 12 done     │  │ 0 of 8 done      │        │
│  │ updated 2h ago   │  │ updated 3d ago   │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                     │
│  ┌──────────────────┐                              │
│  │ Packing list     │                              │
│  │ ────             │                              │
│  │ 12 of 12 done ✓  │                              │
│  │ updated 1w ago   │                              │
│  └──────────────────┘                              │
└─────────────────────────────────────────────────────┘
```

Empty state: "No lists yet. Paste a list of things to start."

### Create-list panel (modal)

```
┌─────────────────────────────────────┐
│  New list                       [×] │
├─────────────────────────────────────┤
│  Name                               │
│  [_______________________________]  │
│                                     │
│  Items (optional — paste anything)  │
│  ┌─────────────────────────────┐   │
│  │ milk                        │   │
│  │ eggs                        │   │
│  │ bread                       │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  3 items detected                   │
│                                     │
│  [Cancel]            [Create list]  │
└─────────────────────────────────────┘
```

Live preview of detected item count (parser runs as user types).

### List detail (drill-in)

```
┌─────────────────────────────────────────────────────┐
│  ← Back to lists                                    │
│                                                     │
│  Groceries                                  [···]   │
│  4 of 12 done                                       │
│                                                     │
│  ┌─────────────────────────────────┐               │
│  │  paste more items or type one…  │               │
│  └─────────────────────────────────┘               │
│                                                     │
│  ☐  milk                          ↑↓  ✎  🗑       │
│  ☐  eggs                          ↑↓  ✎  🗑       │
│  ☑  bread (struck through)        ↑↓  ✎  🗑       │
│  ☑  flour (struck through)        ↑↓  ✎  🗑       │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

### Item operations

| UX | Implementation |
| -- | -------------- |
| Toggle complete | Click checkbox → flip `completed`, PATCH metadata.items |
| Edit title | Click ✎ → inline text input, Enter to save, Esc to cancel |
| Delete | Click 🗑 → confirm inline (no native confirm per CLAUDE.md), 3s undo toast |
| Reorder up | Click ↑ → swap with previous item in array, PATCH |
| Reorder down | Click ↓ → swap with next item in array, PATCH |
| Add item | Type in top textarea → Enter or "Add" button → push to array, PATCH. Multi-line paste → run parser, push N items |
| Mark all done | Menu item in [···] |
| Clear completed | Menu item in [···] — removes `completed: true` items |
| Delete list | Menu item in [···] → confirm inline → DELETE entry |
| Rename list | Click title → inline edit, PATCH entry.title |

**No drag-drop in v1.** Up/down arrows work on every device, no library needed. Drag-drop is a v2 polish.

---

## Performance

- A list with 500 items renders fine without virtualization (each row is ~40px → 20k px tall, browser scrolls naturally).
- For lists > 500 items: warn on import, allow but flag in console; v2 adds virtualization.
- `metadata.items` array of 500 with avg 30-char titles ≈ 30 KB JSON per list. Well under the row-size cap.

---

## Telemetry

PostHog events to add to `src/lib/events.ts`:

```ts
list_created           { item_count: number, source: "typed" | "pasted" | "file" }
list_item_added        { source: "typed" | "pasted" }   // fires once per add op, not per item
list_completed_full    { item_count: number }   // every item checked → milestone
```

Surface in the funnel dashboard as a leading indicator: "do users who create a list have higher Day-7 retention than those who don't?"

---

## v2 deferrals (parked in BRAINSTORM)

Documented but explicitly out of v1:

- File upload (Word `.docx`, PDF, Excel `.xlsx`) — extraction via existing `fileExtract.ts` already handles MD/PDF/Word; Excel needs a new parser
- AI prose split (`"here are some movies: Inception, Tenet, Memento"` → 3 items)
- Per-item embedding for cross-list semantic search
- Vault-encrypted lists ("list of API keys")
- List templates ("groceries", "packing", "movie-night")
- Drag-drop reorder
- Cross-brain shared lists
- "Convert item → standalone entry" (graduate a list item to a real memory)
- Push notifications "your X list has 3 unchecked items"
- Recurring lists (groceries that reset weekly)

---

## Build sequence

| Step | Output | Verify |
| ---- | ------ | ------ |
| 1 | Spec + BRAINSTORM v2 entries | This doc + BRAINSTORM.md updated |
| 2 | Feature flag + types + nav icon | `lists` flag visible in admin panel |
| 3 | Parser + parser tests | `npm run test src/lib/__tests__/listParser.test.ts` green |
| 4 | CreateListPanel | Manual: opens, type a name + paste 3 lines, see "3 items detected" |
| 5 | ListDetail | Manual: drill in, all 6 ops work (add, check, edit, ↑↓, delete) |
| 6 | ListsView (index) | Manual: see grid of cards, click → ListDetail; "+ New list" → CreateListPanel |
| 7 | Wire NAV_VIEWS + MobileMoreMenu + render block in Everion | Sidebar + MoreMenu show "Lists"; tap → ListsView; flag off → hidden |
| 8 | Tests update + commit | All tests green; manual smoke on dev server |
| 9 | Deploy + verify in prod with `VITE_FEATURE_LISTS` unset → invisible | Prod doesn't show Lists tab |

Estimated 1.5 dev days. Ship as one commit if it stays under ~1500 LOC; otherwise split parser+flag+spec from UI.
