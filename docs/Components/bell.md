# Notification Bell

End-to-end map of the bell icon in the header — where it lives, what feeds
it, what each card does, how things get cleared. Reflects state as of
commit `33d3b7d` (2026-04-29).

## TL;DR

- One bell, one source of truth (`public.notifications` table). Every entry
  point — Gmail scan, merge detection, persona hygiene, cron pushes —
  writes a row there. The client polls / refetches and renders cards.
- Badge dot lights up when **either** there's an unread notification **or**
  there are Gmail items waiting in the staging inbox. Two independent
  sources of "you have something to look at."
- Clearing is per-row (Dismiss button) or wholesale (Clear all). Some
  types auto-clear when the underlying state changes (e.g. `gmail_scan`
  notifications evaporate once the staging inbox is empty).

---

## File map

| File | Role |
|---|---|
| `src/components/NotificationBell.tsx` | The bell + dropdown panel + four card components |
| `src/hooks/useNotifications.ts` | Fetches, dismisses, marks-read, accepts merges |
| `src/hooks/useStagedCount.ts` | Polls staged Gmail count for the badge |
| `src/Everion.tsx:178` | Mounts `useNotifications`, threads handlers into the header |
| `src/components/DesktopHeader.tsx:234` | Bell render point on desktop |
| `src/components/MobileHeader.tsx:78` | Bell render point on mobile |
| `src/MemoryHeader.tsx:78` | Bell render point on the Memory view's standalone header |
| `api/user-data.ts:1352` (`handleNotifications`) | GET / PATCH / DELETE for the table |
| `api/_lib/mergeDetect.ts:242` (`storeNotification`) | Insert helper used by gmail/persona/merge paths |
| `api/user-data.ts:1086` (`insertCronNotification`) | Insert helper used by the three cron sites |

---

## Data shape

Stored in `public.notifications`. Client receives:

```ts
interface AppNotification {
  id: string;
  type: "merge_suggestion" | "gmail_review" | "auto_merged" | string;
  title: string;
  body?: string;
  data: Record<string, any>;     // type-specific payload
  read: boolean;
  dismissed: boolean;
  created_at: string;
}
```

The `type` field drives which card component renders. The string union in
the type is documentation-only — the table accepts any string, and the
bell falls back to `AutoMergedCard` for unknown values.

---

## Where notifications come from

### Live types (something inserts a row)

| `type` | Source | Triggered by | Renders as |
|---|---|---|---|
| `gmail_scan` | `api/_lib/gmailScan.ts` (5 sites: lines 1888, 1942, 1976, 2004, 2032, 2042) | End of every Gmail scan — manual or cron | `GmailScanCard` |
| `gmail_review` | (legacy — no live writers found in `api/`) | Older review-modal flow, kept for back-compat | `GmailReviewCard` |
| `merge_suggestion` | `api/_lib/mergeDetect.ts` | A new entry's similarity to an existing one passes the merge threshold | `MergeCard` |
| `auto_merged` | `api/_lib/mergeDetect.ts` (high-confidence path) | Auto-merged silently — purely informational | `AutoMergedCard` |
| `persona_dedup` | `api/_lib/personaHygiene.ts:280` | Weekly persona dedup pass found candidates | `AutoMergedCard` (catch-all) |
| `persona_digest` | `api/_lib/personaHygiene.ts:305` | Weekly persona digest summary | `AutoMergedCard` (catch-all) |
| `cron_summary` | `api/user-data.ts` `handleCronDaily` | Daily cron admin summary (gated by `admin_summary_enabled`) | `AutoMergedCard` (catch-all) |
| `daily_prompt` | `api/user-data.ts` `handleCronHourly` | Per-user daily capture prompt at chosen local time | `AutoMergedCard` (catch-all) |
| `weekly_nudge` | `api/user-data.ts` `handleCronHourly` | Weekly nudge at chosen local time | `AutoMergedCard` (catch-all) |
| `test_push` | `scripts/test-push.mjs` | Admin → Push diagnostics → Send test push | `AutoMergedCard` (catch-all) |

### Inserter helpers

Two functions write notifications. They differ in import surface — both do
the same `POST /rest/v1/notifications`.

```ts
// api/_lib/mergeDetect.ts — used by gmail scan, persona hygiene, merge detect
storeNotification(userId, type, title, body, data)

// api/user-data.ts — used by cron paths that already have SB_URL/SB_KEY
insertCronNotification(userId, type, title, body, data)
```

---

## Client lifecycle

### `useNotifications` hook (`src/hooks/useNotifications.ts`)

State + handlers. Owned by `Everion.tsx`, threaded into the header.

| Trigger | Action |
|---|---|
| Mount | `GET /api/notifications` |
| Window `focus` event | Refetch |
| `visibilitychange` → visible | Refetch |
| `dismiss(id)` | Optimistic remove + `PATCH /api/notifications {id, dismissed:true}` |
| `markRead(id)` | Optimistic flip + `PATCH /api/notifications {id, read:true}` |
| `dismissAll()` | Optimistic empty + `DELETE /api/notifications` (server marks all undismissed → dismissed) |
| `acceptMerge(notif)` | `POST /api/entries?action=merge_into` then dismiss |

`unreadCount` = `notifications.filter(n => !n.read).length`. Drives the dot.

### `useStagedCount` hook (`src/hooks/useStagedCount.ts`)

Independent badge driver for Gmail-staged items.

| Trigger | Action |
|---|---|
| Mount | `GET /api/entries?staged=true` |
| `everion:staged-changed` window event | Refetch |

`GmailStagingInbox.triggerAccept/Reject` fires the event after the PATCH /
DELETE resolves (post-`fix(gmail-inbox)` commit `9ad2ad2`). Before that fix
the event fired sync, so the count refresh saw stale server state.

### Bell badge logic (`NotificationBell.tsx:478` after the recent fix)

```ts
const hasSignal = unreadCount > 0 || stagedCount > 0;
```

The dot is ember (`var(--ember)`), 8×8, top-right of the bell button. It
appears whenever **either** signal is non-zero. `aria-label` joins both:
`"Notifications · 3 unread · 5 in inbox"`.

---

## Cards: rendering and buttons

The dropdown panel iterates `notifications.map(n => ...)`. The `type`
switch picks one of four card components.

### MergeCard (`type === "merge_suggestion"`)

Displays a side-by-side preview of the new entry vs. the existing one,
the confidence score, and a list of fields that would be added.

Buttons:
- **Keep separate** — calls `onDismiss(n.id)` → `dismiss()` → PATCH
  `dismissed=true`.
- **Merge →** — calls `onAcceptMerge(n)` → `acceptMerge(n)` → POSTs
  `/api/entries?action=merge_into` with `{target_id}` from `n.data`, then
  dismisses the notification on success.

### GmailScanCard (`type === "gmail_scan"`)

Renders an inbox icon, title, body. Has a special "with items" mode
when `n.data.created > 0`.

Buttons (only when there are items to review):
- **Dismiss** — calls `onDismiss(n.id)`. Drops the notification but
  leaves the staged Gmail entries in the inbox (you'd review them via
  Settings → Gmail Sync → Inbox).
- **Open inbox** — dispatches `everion:open-gmail-inbox` window event.
  `Everion.tsx` listens, switches to Settings, then tells `GmailSyncTab`
  to open its staging modal. Then dismisses the notification.

When `n.data.created === 0` ("No new entries found"), no buttons render —
the card is informational only and auto-dismissed on bell close (see
"Auto-dismiss" below).

### GmailReviewCard (`type === "gmail_review"`)

Legacy flow — older Gmail-scan-with-inline-review pattern. No live code
path inserts this type today. Buttons:
- **Dismiss** — `onDismiss(n.id)`.
- **Review** — calls `openGmailReview(n)`, which sets `reviewItems` from
  `n.data.items` and opens the `GmailScanReviewModal` directly within
  the bell's portal.

### AutoMergedCard (`type === "auto_merged"` and the catch-all)

Compact one-line card with a moss-green checkmark, title, body, and a
single ✕ Dismiss button. Used by:
- `auto_merged` (the intended type)
- Every other type the bell doesn't have a dedicated card for —
  `persona_dedup`, `persona_digest`, `cron_summary`, `daily_prompt`,
  `weekly_nudge`, `test_push`, anything new.

Single button: **✕** — calls `onDismiss(n.id)`.

---

## How notifications get cleared

Three paths.

### 1. Per-row Dismiss

Every card has a Dismiss action. It calls `onDismiss(n.id)` →
`useNotifications.dismiss(id)` → optimistically removes from state + PATCHes
`dismissed: true`. The row stays in the database with `dismissed=true` for
audit but is filtered out of the GET (which uses `dismissed=eq.false`).

### 2. Clear all

Header button in the dropdown when `notifications.length > 0`. Calls
`onDismissAll()` → `useNotifications.dismissAll()` → optimistic empty +
`DELETE /api/notifications` (which is implemented as a bulk PATCH that
flips every undismissed row to dismissed for that user; supports an
optional `?type=` filter, currently unused).

### 3. Auto-dismiss

Two mechanisms inside the bell itself:

#### On staging-inbox empty (`NotificationBell.tsx:426`)

```ts
useEffect(() => {
  if (stagedCount > 0) return;
  notifications
    .filter(n => n.type === "gmail_scan" && (n.data?.created ?? 0) > 0)
    .forEach(n => onDismiss(n.id));
}, [stagedCount, notifications, onDismiss]);
```

When the user has reviewed everything in the Gmail staging inbox,
`stagedCount` drops to 0 and any `gmail_scan` notifications that had
items are auto-dismissed — they're stale at that point.

#### On bell close (`handleClose` at line 433)

```ts
function handleClose() {
  setOpen(false);
  notifications
    .filter(n => n.type === "gmail_scan" && !((n.data?.created ?? 0) > 0))
    .forEach(n => onDismiss(n.id));
}
```

Closing the bell auto-dismisses informational `gmail_scan` notifications
("No new entries found") — they're noise after the user has seen them
once. Notifications **with** staged items persist until the inbox-empty
effect kills them.

### Mark-read on open

`handleOpen` at line 453 marks all unread notifications as read when the
user opens the bell. This clears the dot but doesn't dismiss the rows —
they stay visible until explicitly dismissed.

---

## Server endpoint (`/api/notifications`)

All routed through `api/user-data.ts:1352`-ish via the rewrite at
`vercel.json:18` (`/api/notifications` → `/api/user-data?resource=notifications`).

| Method | Behavior |
|---|---|
| GET | `dismissed=eq.false` by default, `?dismissed=true` to fetch dismissed history. Order by `created_at desc`, limit 50. |
| PATCH | Body `{id, read?, dismissed?}` — flips one row. Either flag may be set independently. |
| DELETE | Body or query — bulk PATCH `dismissed=true` for all undismissed rows belonging to the user. Optional `?type=<x>` filter to clear only one type. |

All three paths require auth and respect RLS — users only see / modify
their own rows.

---

## Recent changes worth knowing

- **Commit `33d3b7d`** (2026-04-29): Cron pushes now also write
  notifications. Three new types (`cron_summary`, `daily_prompt`,
  `weekly_nudge`) and one diagnostic type (`test_push`) land in the bell.
  Helper `insertCronNotification` extracted in `user-data.ts`.
- **Commit `9ad2ad2`** (2026-04-29): Bell badge now lights on `stagedCount`
  too, not just `unreadCount`. Fixed swipe gesture stale-state bug and the
  PATCH/event race that kept the inbox count stuck after accept.

---

## Known limitations / future work

- Bell pulls a max of 50 notifications. There's no infinite scroll. If
  you somehow accumulate > 50, only the newest 50 show.
- No grouping. Twenty `daily_prompt` notifications stack one per row.
  Could collapse "5 daily prompts this week" into a single card if
  capture rate stays low.
- No push-to-bell push (Service Worker → window message). The bell only
  refetches on focus / visibility. If a notification arrives while the
  app is open and visible, the badge updates only on the next refetch
  trigger (typically the user clicking back into the tab).
- `gmail_review` is a dead type — all known writers are gone, but the
  card component is kept around in case the legacy flow gets restored.
  Could be removed in a cleanup pass.
- Auto-dismiss has no undo. If a user dismisses by accident, the row is
  marked dismissed in the DB and disappears from the GET. There's no UI
  to recover it short of editing Supabase directly.
