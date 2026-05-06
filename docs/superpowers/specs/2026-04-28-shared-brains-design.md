# Shared Brains — Phase 1 (Multi-Brain Plumbing)

**Date:** 2026-04-28
**Status:** Approved (brainstorm 2026-04-28)
**Supersedes:** `2026-04-03-community-brain-design.md` (different model — that spec dropped categorical types)

---

## Goal

Bring back multiple brains per user. Phase 1 is **solo multi-brain only** — no sharing, no invites, no roles. Lays plumbing for sharing in phase 2+.

Behind feature flag `multiBrain`. Off by default in prod.

When flag on:

1. User can create / rename / delete additional brains beyond personal
2. Brain switcher in **header bar**
3. Brain switcher in **capture sheet** (per-capture redirect)
4. **Move-to-brain** action on entry edit
5. All views (My Day, Schedule, Search, Chat, Graph, Vault, Someday) scope to active brain

Phase 2+ work (invites, members, observers, RLS for sharing) is parked in `LAUNCH_CHECKLIST.md` P2.

---

## Non-Goals (deferred to phase 2+)

- Inviting other users (email or link)
- `brain_members`, `brain_invites` tables
- Roles (member / observer)
- RLS policies for shared brains
- Member management UI
- Email-redemption flow via Resend
- Audit-log events for member changes
- Cross-user permissions

Phase 1 is "multiple notebooks, all yours."

---

## Data Model

### Migration `058_multi_brain_phase_1.sql`

```sql
-- 1. Drop the one-brain-per-user constraint from migration 025
ALTER TABLE brains DROP CONSTRAINT IF EXISTS brains_one_per_user;

-- 2. Mark personal brain
ALTER TABLE brains
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Backfill: every existing brain is the user's personal brain
UPDATE brains SET is_personal = true WHERE is_personal = false;

-- Enforce: exactly one personal brain per user
CREATE UNIQUE INDEX IF NOT EXISTS brains_one_personal_per_user
  ON brains(owner_id) WHERE is_personal = true;

-- 3. Update signup trigger to set is_personal
CREATE OR REPLACE FUNCTION create_personal_brain_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO brains (name, owner_id, is_personal)
  VALUES ('My Brain', NEW.id, true);
  RETURN NEW;
END;
$$;

-- 4. Persist active brain on user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS active_brain_id UUID
    REFERENCES brains(id) ON DELETE SET NULL;

-- 5. RLS — owner can do anything with own brains; shared access deferred
DROP POLICY IF EXISTS brains_owner_all ON brains;
CREATE POLICY brains_owner_all ON brains FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- entries policies already filter by brain_id → owner_id chain; no change needed.
-- All entries continue to inherit access from brain.owner_id (same user).
```

### Resulting `brains` shape

| Column        | Type        | Notes                                              |
| ------------- | ----------- | -------------------------------------------------- |
| `id`          | UUID        | PK                                                 |
| `name`        | TEXT        | Required, 1-60 chars                               |
| `description` | TEXT        | Optional, 0-280 chars                              |
| `owner_id`    | UUID        | FK to `auth.users`                                 |
| `is_personal` | BOOLEAN     | Exactly one true row per `owner_id` (partial idx)  |
| `created_at`  | TIMESTAMPTZ |                                                    |
| `updated_at`  | TIMESTAMPTZ |                                                    |

No `type` column. No `visibility`, `join_code`, `category`, `moderation`. Pure blank slate.

---

## API Changes

**Hard rule:** 12-function Hobby cap. Reuse existing handlers, do not add new `api/*.ts` files.

### `api/user-data.ts` (already routes via `?resource=`)

Add resources:

| Method | Resource                        | Action                                        |
| ------ | ------------------------------- | --------------------------------------------- |
| GET    | `?resource=brains`              | List user's brains                            |
| POST   | `?resource=brains`              | Create new brain (`{name, description?}`)     |
| PATCH  | `?resource=brains&id=<uuid>`    | Rename / edit description                     |
| DELETE | `?resource=brains&id=<uuid>`    | Delete brain (blocked if `is_personal=true`)  |
| POST   | `?resource=brains&action=set-active&id=<uuid>` | Update `user_settings.active_brain_id` |

Brain delete cascades to entries (existing FK with `ON DELETE CASCADE`). Confirm in migration audit before shipping; if not cascade, add it in `058`.

### `api/entries.ts`

Add action:

| Method | Action                                     | Behaviour                                                    |
| ------ | ------------------------------------------ | ------------------------------------------------------------ |
| POST   | `?action=move&id=<uuid>&brain_id=<uuid>`   | Update `entries.brain_id`. Flag for re-embed. Sever cross-brain graph edges. |

**Move side-effects (server-side, atomic where possible):**

1. `UPDATE entries SET brain_id = $new_brain WHERE id = $entry AND owner_id = $user`
2. `DELETE FROM concept_graph_edges WHERE source_entry_id = $entry OR target_entry_id = $entry` (rebuild on next graph job)
3. Mark `entries.embedding_dirty = true` (column exists from migration 040; reuses re-embed worker)
4. Reminders / attachments / status follow via FK — no action needed

All scoped to `owner_id = auth.uid()` in WHERE — phase 1 cannot move entries across users (no sharing yet).

### Read scope on every existing endpoint

Reads currently filter by `entries.owner_id`. Add **active-brain filter** in the data layer:

```ts
// src/data/queries.ts (representative)
.eq("owner_id", userId)
.eq("brain_id", activeBrainId)  // NEW
```

Endpoints touched (read paths only): `/api/entries`, `/api/search`, `/api/llm` (chat context), `/api/calendar`, `/api/v1` (graph). Each must accept `brain_id` from client (via header `x-brain-id` or query param) and apply the filter.

**Stale active-brain handling:** if client sends `x-brain-id` for a brain the user no longer owns or that's been deleted, server returns `409 Conflict { error: "stale_brain", fallback_brain_id: <personal_id> }`. Client clears local active and refetches.

---

## Frontend Changes

### Feature flag

```ts
// src/lib/featureFlags.ts
export const FEATURE_FLAGS = {
  // ...existing flags
  multiBrain: {
    label: "Multi-brain",
    icon: "🧠",
    prodEnabled: import.meta.env.VITE_FEATURE_MULTI_BRAIN === "true",
  },
} as const satisfies ...;
```

When `isFeatureEnabled("multiBrain", adminFlags) === false`, the app behaves exactly as today (single personal brain, no switcher, no move action). All new UI is gated.

### 1. Header brain switcher

**File:** `src/components/BrainSwitcher.tsx` (revive — was deleted in 025 era)

**Placement:** Header bar, left of user avatar (desktop) / replacing top-left icon (mobile).

**Behaviour:**
- Closed: shows active brain name + chevron, max 18 chars truncated with ellipsis
- Open: dropdown with
  - Personal brain pinned at top with subtle "Personal" subtitle
  - User's other brains, alphabetical
  - Footer: `+ New brain` link → opens CreateBrainModal
- Click brain → POST `?resource=brains&action=set-active`, refetch all data layer queries with new `brain_id`
- Long-press / right-click / kebab on a brain row → open Settings → Brains tab focused on that brain

**Visual:** matches existing dropdown patterns (use Radix `DropdownMenu` already in deps). Personal-brain row has small `★` glyph.

### 2. Capture sheet brain switcher

**File:** `src/components/CaptureSheet.tsx` (existing, modify)

Add a small pill at top of sheet showing target brain (defaults to active). Tap pill → mini-popover with brain list. Selecting a different brain redirects this single capture without changing the global active brain.

After capture submits and sheet closes, app context returns to whatever was active before.

### 3. Move-to-brain in entry edit

**File:** `src/components/EntryEditDrawer.tsx` (or equivalent existing edit surface)

New row in edit form: **Move to brain** → opens picker → confirm modal:

> "Move 'Entry title' from **Family Brain** to **Smash Burger Bar**?
>
> Concept-graph links to other entries in Family Brain will be removed. Embeddings will refresh in the background."
>
> [Cancel] [Move]

POST `/api/entries?action=move`. On success, drawer closes and the moved entry disappears from current view (since active brain is the source brain).

### 4. CreateBrainModal

**File:** `src/components/CreateBrainModal.tsx`

Single form:

- Name (required, 1-60 chars)
- Description (optional, 0-280 chars, textarea)
- [Cancel] [Create]

Submit → POST `?resource=brains` → on success, switcher dropdown refreshes, new brain not auto-activated (feels less jarring; user clicks to switch).

### 5. Settings → Brains tab

**File:** `src/views/settings/BrainsTab.tsx` (new tab in existing settings sidebar)

Sidebar entry "Brains" (replacing or alongside existing "Brain" singular tab — pick whichever exists; if a singular tab exists, rename to "Brains" plural and house both personal-mgmt and multi-brain mgmt in it).

Content:

- List of brains (table-ish):
  - Name (editable inline)
  - Description (editable inline)
  - Created date
  - Entry count (from existing `count_entries_by_brain` view if present, else simple subquery)
  - Personal badge on the personal row
  - Delete button (disabled on personal, confirmation modal on others)
- "+ Create brain" button (opens CreateBrainModal)

### 6. Active-brain client state

**File:** `src/hooks/useActiveBrain.ts` (new)

```ts
export function useActiveBrain() {
  // Reads from user_settings on mount
  // Returns { activeBrainId, setActiveBrain, isLoading }
  // setActiveBrain hits API, invalidates all data-layer queries
}
```

All data-layer hooks (`useEntries`, `useSchedule`, `useChat`, etc.) consume `activeBrainId` and pass it to API calls. Query keys include the brain id so React Query auto-invalidates on switch.

**No localStorage.** DB is single source of truth (Q8 = A). On cold load, while `useActiveBrain` is fetching, app shows a thin top-bar spinner; data-layer queries wait.

### 7. Stale-brain recovery

If `useActiveBrain` returns a brain id that 409s on first data fetch (deleted, or pre-`058` row), client:

1. Clears active in DB (`set-active` to personal)
2. Toasts "That brain was removed — back to your personal brain."
3. Refetches.

---

## Component Boundaries

Each unit has one job:

| Unit                       | Purpose                                       | Dependencies                |
| -------------------------- | --------------------------------------------- | --------------------------- |
| `useActiveBrain`           | Read/write active brain id                    | API client                  |
| `useBrains`                | List/CRUD user's brains                       | API client                  |
| `BrainSwitcher`            | Render dropdown, fire setActive               | `useActiveBrain`, `useBrains` |
| `CaptureSheet` brain pill  | Per-capture override                          | `useBrains`                 |
| `EntryEditDrawer` move row | Trigger move-to-brain                         | `useBrains`, entries API    |
| `CreateBrainModal`         | Create form                                   | `useBrains`                 |
| `BrainsTab`                | List/rename/delete                            | `useBrains`                 |

`useBrains` and `useActiveBrain` are independent of each other except where the switcher composes both.

---

## Testing

### New e2e specs (Playwright, gated behind flag)

- `e2e/multi-brain.spec.ts`:
  - Create brain → appears in switcher
  - Switch brain → entries list changes
  - Capture into a non-active brain via sheet pill → entry lands there
  - Move entry between brains → no longer visible in source view, visible in destination
  - Delete a non-personal brain → entries gone, active resets to personal
  - Cannot delete personal brain (button disabled, API returns 403)

### Unit tests

- `useActiveBrain` cache + 409 fallback path
- `migration 058` round-trip: signup creates personal, can create second brain, partial unique index rejects a second `is_personal=true`

---

## Rollout

1. Ship migration `058` to staging, verify backfill (every existing brain → `is_personal=true`)
2. Enable `multiBrain` admin flag for owner account only
3. Test: create 2nd brain, switch, capture, move, delete
4. Soak 48h, watch Sentry + Postgres logs for 409s on stale-brain
5. Owner toggles flag on for trusted beta users via admin panel
6. Phase 2 begins (sharing) once phase 1 has been used for ~1 week without issue

---

## Risks

| Risk                                                     | Mitigation                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Existing API endpoints leak entries across brains        | Code review every read in `api/entries.ts`, `api/search.ts`, etc.; add brain_id filter unconditionally on the data-layer queries; e2e spec asserts isolation |
| Move-to-brain leaves orphaned graph edges                | Migration includes the `DELETE FROM concept_graph_edges` step; embedding worker re-derives links on next pass |
| Stale `active_brain_id` after a brain delete             | `ON DELETE SET NULL` on FK; client handles null by defaulting to personal |
| Hobby 12-function cap                                    | All new endpoints route through existing `user-data.ts` and `entries.ts` via `?resource=` / `?action=` params; **no new top-level files in `api/`** |
| Personal-brain delete bypassed via direct API            | Server check: `is_personal=true` rows refuse DELETE with 403            |
| Flag-off users see broken UI                             | All multi-brain UI behind `isFeatureEnabled("multiBrain", ...)` checks; default render = today's app |

---

## Open Questions

None blocking phase 1. Phase 2 design will resolve:

- Member role permissions (Q3 = wiki-style edit any) — locked but not yet implemented
- Email-invite redemption flow (Q5 = full email + link) — Resend wired, schema not built
- RLS policies for shared brain access — needs new policy set on `brains`, `entries`, related tables
