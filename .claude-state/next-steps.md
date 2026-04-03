# Next Steps — 2026-04-03

## Immediate (do first)
1. **Apply migrations in Supabase** — Run `supabase/migrations/001_brains.sql` then `supabase/migrations/002_brain_types.sql` in Supabase SQL editor on project `wfvoqpdfzkqnenzjxhui`. Must be done in order. 002 depends on tables created by 001.
2. **Test get_entries_for_brain RPC** — Run in Supabase SQL editor: `SELECT * FROM get_entries_for_brain('<your-personal-brain-id>'::uuid) LIMIT 5;`. If error about DISTINCT ON + UNION, rewrite as CTE: `WITH primary AS (SELECT * FROM entries WHERE brain_id = p_brain_id), shared AS (SELECT e.* FROM entries e JOIN entry_brains eb ON eb.entry_id = e.id WHERE eb.brain_id = p_brain_id AND e.brain_id != p_brain_id) SELECT * FROM primary UNION SELECT * FROM shared ORDER BY created_at DESC LIMIT 500`.
3. **Test CreateBrainModal** — Create a Family brain and a Business brain. Verify BrainSwitcher shows 🏠/🏪 icons. Verify Fill Brain shows correct question set per brain.
4. **Test RefineView gate** — Invite a second user to a family/business brain as member. Log in as that user. Confirm Refine tab shows "Owner Only" gate message.

## Soon (this milestone)
- **Add metadata editing to DetailModal** — `src/views/DetailModal.jsx` edit form only edits title/type/content/tags. Add `metadata.due_date` and `metadata.day_of_week` fields so reminders and recurring events can be edited in the UI.
- **Wire GraphView + CalendarView to live entries** — Both still use `INITIAL_ENTRIES` static data. Pass `entries` and `links` props from `src/OpenBrain.jsx`.
- **Pass live links to DetailModal** — `src/views/DetailModal.jsx` reads from static `LINKS`/`INITIAL_ENTRIES`. Add `entries` and `links` props for Connections section.
- **Fix QuickCapture offline path** — `src/OpenBrain.jsx` QuickCapture `doSave` offline branch does not pass `p_brain_id`. Add `p_brain_id: primaryBrainId` to the `enqueue()` call body JSON.
- **Delete SupplierPanel dead code** — `src/OpenBrain.jsx` still contains SupplierPanel component + `{view === "suppliers" && ...}` render line; tab was removed from nav.

## Deferred
- Full morning briefing push notification — `public/sw.js` needs `push` event handler
- Replace in-memory rate limiter with Upstash Redis — `api/_lib/rateLimit.js`
- TodoView: wire reminder-type entries from DB — `src/views/TodoView.jsx` currently localStorage-only
- Activity log UI — `api/activity.js` exists but no frontend view yet; add to Settings or a brain detail panel
- Monetisation tiers (Phase 2) — free/pro/team tiers, Stripe integration, usage quotas

## Warnings
- ⚠️ migration 001 must be applied BEFORE 002 — 002 references `brains`, `brain_members`, and `entries` tables created by 001.
- ⚠️ `get_entries_for_brain` RPC — DISTINCT ON inside UNION may fail in some Postgres versions. Test immediately after applying migration. Fix: use CTE (see Immediate step 2).
- ⚠️ `capture()` RPC may still hardcode `v_owner_id` — verify: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'capture'`.
- ⚠️ OnboardingModal shows for ALL users with no localStorage flag — existing users will see it once. This is acceptable but if unwanted, backfill `localStorage.setItem("openbrain_onboarded","1")` in console.
