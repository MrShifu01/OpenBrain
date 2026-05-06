# Shared-brain notifications — spec

When an entry in a shared brain has a date that's about to come due, every member of the brain who has opted in should be told. Today's notification system is purely user-scoped (see `architecture/bell.md` § "How notifications relate to brains") — this spec extends it to fan out at the right moments without becoming spam.

> **Decided 2026-05-05** (this session): ship as P1 for public launch. Solo and personal-brain use cases unaffected.

## Goal

A due date in a shared business brain is a shared liability. If only the entry author hears the 7-day-out push, the shared brain collapses into "private todo with extra steps." We want every member with read access to be reminded — but with a one-click way to mute a brain that's gone noisy.

## Non-goals (v1)

- **No fan-out on entry creation.** "Mom added a memory" is noise, not signal. Read it on next visit.
- **No per-type granularity.** A brain is either "all due dates", "owner-only", or "off". No "due dates yes, merge no" levels in v1.
- **No push to email.** Web Push + in-app bell only. Email digest deferred to BRAINSTORM.
- **No calendar push.** Pushing due dates into Google Cal is a separate spec.
- **No read receipts.** Knowing which member has seen a reminder is useful but adds a write/UI surface — defer.

## Trigger surface (which date types fan out)

The expiry cron looks at four metadata fields on each entry, in priority order:

```
metadata.due_date | metadata.deadline | metadata.expiry_date | metadata.event_date
```

This matches `api/_lib/getUpcoming.ts:UPCOMING_DATE_FIELDS`. A single entry typically has only one of these set.

Lead-day series comes from `notification_prefs.expiry_lead_days`, default `[90, 30, 7, 1]`. Each member can shorten or lengthen their personal series in `Settings → Notifications`. The cron fires once per `(member, entry, lead_day)` tuple — never twice.

## Schema changes

### New table: `public.brain_notification_prefs`

Per-(user, brain) override of the global `notification_prefs.expiry_enabled`. If no row exists, default is `level='all'` (member is opted-in).

```sql
CREATE TABLE public.brain_notification_prefs (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brain_id   uuid NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE,
  level      text NOT NULL CHECK (level IN ('all', 'owner_only', 'off')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, brain_id)
);
ALTER TABLE public.brain_notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY bnp_owner ON public.brain_notification_prefs
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
```

`level` semantics (interpreted at fan-out time):
- `all` — receive every reminder for this brain (default).
- `owner_only` — only fire if the recipient is the brain owner. (Useful when the bookkeeper wants to mute the owner's brain but the owner still wants pings.)
- `off` — receive nothing for this brain.

`owner_only` is a per-recipient choice — "I, this user, only want to be pinged if I'm the owner of the brain in question." Members default to `all`. The owner of a brain almost always sets `all` for their own brain (they care about their own due dates).

### Alter: `expiry_notification_log` (add `brain_id`)

Today: `UNIQUE(user_id, entry_id, item_label, lead_days)`. With fan-out, we need to log per-(member, brain) so a user who is in two brains both containing the same entry (impossible today, but possible if entries get cross-brain-linked later) can't double-fire.

```sql
ALTER TABLE public.expiry_notification_log
  ADD COLUMN IF NOT EXISTS brain_id uuid REFERENCES public.brains(id) ON DELETE CASCADE;

-- Replace the unique constraint with a (user, entry, brain, lead_days) tuple.
ALTER TABLE public.expiry_notification_log
  DROP CONSTRAINT IF EXISTS expiry_notification_log_user_id_entry_id_item_label_lead_d_key;
ALTER TABLE public.expiry_notification_log
  ADD CONSTRAINT expiry_log_user_entry_brain_lead_uniq
  UNIQUE (user_id, entry_id, brain_id, lead_days);
```

Existing rows have `brain_id IS NULL` — that's fine; the new uniqueness includes NULL distinctly per Postgres semantics, so no backfill is required.

## Cron path

Hooked into `handleCronHourly` (`api/user-data.ts:2150`-ish). Fires alongside the existing daily-prompt and weekly-nudge logic.

```
for each user U with notification_prefs.expiry_enabled = true:
  for each brain B that U can access (owner OR brain_members.user_id = U.id):
    bnp = brain_notification_prefs(U.id, B.id)  -- default 'all' if missing
    if bnp.level == 'off': continue
    if bnp.level == 'owner_only' and B.owner_id != U.id: continue

    for each entry E in B with a date field falling within
        (today + min(prefs.expiry_lead_days)) days:
      day_offset = (E.date - today) in days
      if day_offset not in prefs.expiry_lead_days: continue
      if expiry_notification_log already has (U.id, E.id, B.id, day_offset): continue

      sendPush(U, "{lead} days · {entry.title}", "/entries/{E.id}")
      insertNotification(U.id, "expiry_reminder", title, body, { entry_id, brain_id, lead_days })
      insertExpiryLog(U.id, E.id, B.id, day_offset)
```

**Quiet hours**: only fire if the user's local time matches their `daily_time` (default 20:00). This piggy-backs on the existing daily-prompt local-time gate so we don't need a second clock check. (Tradeoff: a user with `daily_enabled=false` but `expiry_enabled=true` still gets pushed at the default 20:00 local-time anchor. Acceptable for v1; revisit if anyone complains.)

**Brain access set**: computed via the same access query the bell uses for entry retrieval — `match_entries_for_user` (migration 071) already enforces "owner OR member OR viewer". Reuse the underlying brain set query rather than re-implementing.

**Idempotency**: the `expiry_notification_log` UNIQUE constraint is the gate. INSERT on conflict do nothing — if cron runs twice in the same hour (rare, but possible during deploys), the second pass silently skips.

## Notification type

Fan-out rows use `type = 'expiry_reminder'` (new). The bell renders them via the catch-all `AutoMergedCard` for v1 — single ✕ Dismiss button. Card-component v2 (deferred): show the entry title, brain badge, lead-days, and "Open entry →" button that deep-links to the entry detail.

```ts
{
  type: "expiry_reminder",
  title: "Liquor licence renewal · 7 days",       // {item} · {lead_days} days
  body: "Due 12 May 2026 · Business brain",       // {due_date} · {brain_name}
  data: {
    entry_id: "...",
    brain_id: "...",
    brain_name: "Business",
    lead_days: 7,
    due_date: "2026-05-12",
    field: "due_date" | "deadline" | "expiry_date" | "event_date",
    url: "/entries/{id}",
  },
}
```

## UI

### `Settings → Notifications` — per-brain row

A list of brains the user belongs to, each with a 3-state pill toggle.

```
Family brain                [● All]  [  Owner-only  ]  [  Off  ]
Business · SmashBurgerBar   [  All  ]  [● Owner-only  ]  [  Off  ]
Personal                    [● All]  [  Owner-only  ]  [  Off  ]
```

The component reads `brain_notification_prefs` for the current user, defaults missing rows to `all`. On toggle, optimistic write + PATCH to `/api/user-data?resource=brain-notification-prefs`.

For the Personal brain (single member), the pill is rendered but the only relevant levels are `all` / `off`. `owner_only` is functionally identical to `all` for the owner — UI can hide it for personal brains, or just allow the user to pick whichever.

### `Settings → Notifications` — global expiry section

Existing `expiry_enabled` master switch stays. If it's OFF, no due-date reminders fire regardless of per-brain prefs. The per-brain toggles only matter when the master is ON.

### Bell card

`AutoMergedCard` (existing) renders `expiry_reminder` for v1. Future enhancement: dedicated `ExpiryCard` with brain pill + entry chip + "Open entry" CTA.

## API endpoints

New action under the existing `user-data.ts` handler (no new top-level file — Hobby 12-fn limit):

| Path | Methods | Body | Behavior |
|---|---|---|---|
| `/api/user-data?resource=brain-notification-prefs` | `GET` | — | Return all rows for the authed user, joined with brain name + role |
| `/api/user-data?resource=brain-notification-prefs` | `PUT` | `{ brain_id, level }` | Upsert one row. Validates user has access to that brain. |

`vercel.json` rewrite: `/api/brain-notification-prefs` → `/api/user-data?resource=brain-notification-prefs`.

## Acceptance criteria

- [ ] Migration 075 + 076 applied on staging — `brain_notification_prefs` exists, `expiry_notification_log` has `brain_id`.
- [ ] User with `expiry_enabled=true` and a shared business brain receives a push **and** in-app notification 7 days before a `due_date` on a brain entry — even if they didn't author the entry.
- [ ] User who sets level=`off` for the brain receives nothing for it.
- [ ] User who sets level=`owner_only` for a brain they don't own receives nothing for it.
- [ ] Cron firing twice in one hour (manual re-trigger) does not produce duplicate pushes.
- [ ] Personal brain reminders still work (the fan-out collapses to one user — author).
- [ ] Members who join a brain mid-cycle get reminders only for due dates that haven't passed their lead-day window yet (no backfill of historical reminders).

## Rollout

1. Apply migrations.
2. Ship cron + endpoint behind `VITE_FEATURE_SHARED_BRAIN_REMINDERS` flag (default OFF in production until tested with real users).
3. Ship UI (per-brain toggle) — also gated by same flag.
4. Test on the dev account by adding a fake business brain with a 1-day-out reminder and a member; verify both fire.
5. Flip flag for beta cohort.
6. Remove flag after 7 days of stable behavior.

## References

- `architecture/bell.md` — current notification system (purely user-scoped today)
- `supabase/migrations/004_push_notifications.sql` — existing tables this extends
- `supabase/migrations/068_brain_sharing.sql` — `brain_members` + `brain_invites`
- `api/_lib/getUpcoming.ts` — existing date-field scanner (reuse the field list)
- `api/user-data.ts:handleCronHourly` — where the new fan-out hooks in
- `Specs/imports-spec.md` — sibling spec format
- `EML/LAUNCH_CHECKLIST.md` — P1 entry once this lands

## Future enhancements (deferred)

Captured to BRAINSTORM.md so they don't get lost:

- **Per-type levels** — separate switches for due dates / merge / persona / Gmail
- **Digest mode** — instead of N pushes, send one daily summary at user's chosen time
- **Snooze this notification for X days** — per-row temporary mute
- **Smart prioritization** — bookkeeper auto-pinged on financial entries only; owner pinged on everything
- **Read receipts** — know which member has seen the reminder
- **Email fallback** — if push delivery fails or user has no Service Worker, email them at their daily_time
- **Calendar push** — write upcoming due dates into the user's connected Google / Microsoft calendar so they show up in everyday tools
- **iOS/Android native push** (post-Capacitor) — replace Web Push with APNs/FCM for richer delivery + deep linking
- **Brain digest at member time** — author saved a due date in their morning; member receives the reminder at their evening — current design already handles this via per-user `daily_time`
