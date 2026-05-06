# Streak counter — consecutive-day capture

**Goal:** a small counter on the home view that shows how many days in a row the user has captured at least one entry. Increments at most once per day. Resets to 0 on a missed day. No grace period.

**Why:** consecutive-day streaks are the cheapest, most-proven habit hook in the productivity-app playbook (Duolingo, Strava, Snapchat). For a memory product where retention is the launch metric, a streak is a free engagement multiplier.

Day 13 ship target. Total budget: 1 dev day.

---

## Data model

### Migration `068_streak_counter.sql`

```sql
alter table user_profiles
  add column if not exists streak_days int not null default 0,
  add column if not exists last_capture_date date;

comment on column user_profiles.streak_days is
  'Consecutive-day capture streak. Incremented by /api/capture; reset on missed day. Local timezone resolves which "day" the capture belongs to (see lib/syncTimezone).';

comment on column user_profiles.last_capture_date is
  'YYYY-MM-DD in the user''s IANA timezone of the most recent capture. Used to decide whether the next capture continues the streak, no-ops, or resets.';

-- Backfill: compute streaks for existing users in one pass.
-- Note: this approximates timezone using server UTC for backfill — re-running
-- after the timezone column is populated will refine. Acceptable for MVP since
-- existing users get a reasonable starting number.
update user_profiles up
set
  last_capture_date = (
    select max(date_trunc('day', e.created_at)::date)
    from entries e
    where e.user_id = up.id
  ),
  streak_days = coalesce((
    -- count contiguous days ending today that have ≥1 entry
    with days as (
      select distinct date_trunc('day', e.created_at)::date as cap_date
      from entries e
      where e.user_id = up.id
    ),
    ranked as (
      select cap_date, row_number() over (order by cap_date desc) as rn
      from days
      where cap_date <= current_date
    ),
    streak as (
      select cap_date, rn,
        cap_date - (rn - 1) * interval '1 day' as expected
      from ranked
    )
    select count(*)::int
    from streak
    where cap_date = (select cap_date::date from streak where rn = 1)::date - (rn - 1) * interval '1 day'
  ), 0)
where exists (select 1 from entries e where e.user_id = up.id);
```

**Reversibility:** drop both columns. Backfill data is recomputable.

---

## Increment logic (server)

In `api/capture.ts`, after a successful insert into `entries`:

```ts
// Pseudocode — the tz lookup uses the existing helper in api/_lib/timezone.ts
const tz = await getUserTimezone(userId);
const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD

const { data: profile } = await supabase
  .from("user_profiles")
  .select("streak_days, last_capture_date")
  .eq("id", userId)
  .single();

const last = profile?.last_capture_date;        // YYYY-MM-DD or null
const next = nextStreak(last, todayLocal);

if (next.changed) {
  await supabase
    .from("user_profiles")
    .update({ streak_days: next.streakDays, last_capture_date: todayLocal })
    .eq("id", userId);
}
```

Where `nextStreak` is:

```ts
export function nextStreak(
  last: string | null,
  todayLocal: string,
  prevStreakDays = 0,
): { streakDays: number; changed: boolean } {
  if (last === todayLocal) return { streakDays: prevStreakDays, changed: false };
  const yesterdayLocal = addDays(todayLocal, -1);
  if (last === yesterdayLocal) return { streakDays: prevStreakDays + 1, changed: true };
  return { streakDays: 1, changed: true };
}
```

Add it to `api/_lib/streak.ts` and unit-test it directly — date math is the place where bugs hide.

**Why server-side, not client:** the streak is part of user state. Multiple devices need to see the same number. Client-side would let the user game it by changing their device clock.

---

## Read path (client)

`useDataLayer` already loads user state on mount. Add `streak_days` and `last_capture_date` to the select. Expose via `userProfile.streakDays`.

After a successful capture, call `useDataLayer.refreshUser()` (already exists or add it) so the chip updates without a page reload.

---

## UI surface

Single chip on the home view, top-right of the capture bar:

```
┌────────────────────────────────────────────────────────┐
│  what's on your mind?                    [🔥 12 days] │
└────────────────────────────────────────────────────────┘
```

Tokens: `--ember` for the flame, `--ink` for the text, `12px` font, pill-shaped (`border-radius: 999`), `28px` height. Match the look of existing `Chip` components in the design system per CLAUDE.md.

**Edge cases:**
- `streak_days === 0`: hide the chip entirely. New users don't need a "0 days" badge.
- `streak_days === 1`: show "1 day". (Not "1 days".)
- `streak_days >= 7`: highlight with a slight ember glow (`box-shadow: 0 0 8px var(--ember)`). Cheap dopamine for the milestone.
- `streak_days >= 30`: same glow + replace 🔥 with ⭐. Prepares for higher-tier rewards in v1.

**Hover/long-press tooltip:** "Captured every day for 12 days. Last on Mon May 12."

---

## Edge cases

| Case | Handling |
| ---- | -------- |
| User on a flight Sat → Sun, captures Mon | Mon is 2 days after their last capture, in their tz → reset to 1 |
| User in NYC captures Sat 11pm, then Sun 1am | Both are Saturday and Sunday in their tz → counts as +1 |
| User on a plane crosses dateline | The IANA tz at capture time decides the date — using `Intl.DateTimeFormat` with their stored IANA. Edge cases here are rare; document and move on |
| Offline capture replayed Mon morning for an entry created Sat | Server uses the original `created_at` (which we store at queue time on the client) to decide which day. **Important:** the streak update uses `created_at`'s local date, not the replay date |
| User pre-Mon-2026-05-13 has zero entries but signs up | First-ever capture → `streak = 1`, `last_capture_date = today_local`. Backfill above handles existing users |
| User deletes their only entry from yesterday | Don't decrement. The streak measures *captured*, not *kept*. Recomputing on delete is more complexity than it's worth |
| Two devices capture on the same day | Both updates resolve to the same `streakDays` (idempotent: `last === todayLocal` short-circuits). No race window matters |

---

## Tests

Unit (`api/_lib/__tests__/streak.test.ts`):

```ts
describe("nextStreak", () => {
  it("first capture → 1, changed", () => {
    expect(nextStreak(null, "2026-05-13", 0)).toEqual({ streakDays: 1, changed: true });
  });
  it("same day → no change", () => {
    expect(nextStreak("2026-05-13", "2026-05-13", 7)).toEqual({ streakDays: 7, changed: false });
  });
  it("yesterday → +1", () => {
    expect(nextStreak("2026-05-12", "2026-05-13", 7)).toEqual({ streakDays: 8, changed: true });
  });
  it("two days ago → reset to 1", () => {
    expect(nextStreak("2026-05-11", "2026-05-13", 7)).toEqual({ streakDays: 1, changed: true });
  });
  it("future date (clock skew) → reset", () => {
    expect(nextStreak("2026-05-14", "2026-05-13", 7)).toEqual({ streakDays: 1, changed: true });
  });
});
```

Integration: a Playwright test that captures, captures again same day, asserts the chip still shows 1 day; then mocks the date forward by 1 day, captures, asserts 2 days.

---

## Out of scope (defer)

- Streak freezes (Duolingo-style "you missed a day but here's a free pass") — adds complexity; punishes consistency in the data; defer to month 2 if churn analysis says missed days are a major drop-off
- Public streak leaderboard — anti-pattern for a private memory product
- Streak achievements / badges — clutter; the chip's glow is the achievement
- Push notifications "your streak is in danger" — don't ship without explicit user opt-in; defer to month 2 alongside the broader notifications pass

---

## Commit pattern

- `feat(streak): add streak_days + last_capture_date columns + backfill (068)`
- `feat(streak): increment on /api/capture; expose via /api/user-data?resource=profile`
- `feat(streak): home-view chip`

Three commits keeps the migration isolated, the API contract stable, and the UI a separate easy-to-revert change.
