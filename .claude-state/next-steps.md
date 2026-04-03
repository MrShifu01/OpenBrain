# Next Steps — 2026-04-03

## Immediate (do first)
1. **Apply migration 003 in Supabase** — Open Supabase SQL editor for project `wfvoqpdfzkqnenzjxhui`, paste and run `supabase/migrations/003_personal_brain_trigger.sql`. This activates the personal brain trigger for all new signups.
2. **Apply migrations 001 + 002** — Still needed from prior session (001 first, then 002). `supabase/migrations/001_brains.sql` then `supabase/migrations/002_brain_types.sql`.
3. **Verify Fill Brain view ID** — In `src/OpenBrain.jsx`, grep `navViews` array and confirm the Fill Brain tab id is `"suggest"`. BrainTipCard calls `setView("suggest")` on "Start filling →" — if the id differs, fix in `src/components/BrainTipCard.jsx` `onFill` prop call.
4. **Test BrainTipCard** — Create a Family brain via BrainSwitcher → confirm tip card appears above nav tabs with correct tips → click "Start filling →" confirms it navigates to Fill Brain with that brain active.

## Soon (this milestone)
- **Review + commit prior session changes** — `api/update-entry.js`, `src/components/OnboardingModal.jsx`, `src/views/SuggestionsView.jsx`, `supabase/migrations/001_brains.sql`, `future-plans.md` are modified but unstaged. Review diffs before staging — these are from the prior phase.
- **Add metadata editing to DetailModal** — `src/views/DetailModal.jsx` edit form only edits title/type/content/tags. Add `metadata.due_date` and `metadata.day_of_week` fields.
- **Wire GraphView + CalendarView to live entries** — Both still use `INITIAL_ENTRIES` static data. Pass `entries` and `links` props from `src/OpenBrain.jsx`.
- **Fix QuickCapture offline path** — `src/OpenBrain.jsx` QuickCapture `doSave` offline branch does not pass `p_brain_id`. Add `p_brain_id: primaryBrainId` to the `enqueue()` call body JSON.
- **Delete SupplierPanel dead code** — `src/OpenBrain.jsx` still contains SupplierPanel component + `{view === "suppliers" && ...}` render; tab was removed from nav.

## Deferred
- Invite-aware onboarding — deferred until invite-accept frontend flow (URL token handling) is built
- Full morning briefing push notification — `public/sw.js` needs `push` event handler
- Replace in-memory rate limiter with Upstash Redis — `api/_lib/rateLimit.js`
- TodoView: wire reminder-type entries from DB — `src/views/TodoView.jsx` currently localStorage-only
- Activity log UI — `api/activity.js` exists but no frontend view yet
- Monetisation tiers (Phase 2) — free/pro/team tiers, Stripe integration

## Warnings
- ⚠️ Migration 001 must be applied BEFORE 002 — 002 references tables created by 001.
- ⚠️ Migration 003 is NOT yet applied — personal brain trigger is not live until you run it in Supabase.
- ⚠️ `get_entries_for_brain` RPC — DISTINCT ON inside UNION may fail in some Postgres versions. Test immediately after applying migration 002. Fix: use CTE (see prior next-steps for CTE query).
- ⚠️ Prior session uncommitted files in working tree — do NOT blindly `git add .` — review each diff first.
