# Next Steps — 2026-04-02

## Immediate (do first)
1. Verify edit persistence on live deployment — open an entry, edit it, refresh. If an alert pops, read the error. Deployment: open-brain-sigma.vercel.app.
2. Fix `capture()` RPC hardcoded owner ID — run in Supabase SQL editor (project `wfvoqpdfzkqnenzjxhui`): `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'capture'` to confirm `v_owner_id` is still hardcoded. Then `apply_migration` to replace with `p_user_id` in the INSERT.
3. **Rotate API keys manually** — Anthropic key at console.anthropic.com → API Keys; Supabase service_role + anon at supabase.com → Project Settings → API; update Vercel env vars to match.

## Soon (this milestone)
- Add metadata editing to DetailModal edit form (`src/OpenBrain.jsx`, `DetailModal` ~line 666) — currently title/type/content/tags only; `metadata.deadline`, `metadata.due_date` etc. not editable.
- Wire GraphView and CalendarView to live entries — both use `INITIAL_ENTRIES` static data (`src/OpenBrain.jsx`, GraphView ~line 745, CalendarView ~line 540). Note: LINKS still uses hex IDs, not UUIDs — needs a rethink for live data.
- Add `Content-Security-Policy` to `vercel.json` — currently missing (LOW security finding). Audit inline styles first; OpenBrain uses style objects not `dangerouslySetInnerHTML` so a strict CSP should be feasible.

## Deferred
- Replace in-memory rate limiter with Upstash Redis (`api/_lib/rateLimit.js`) — low priority for single-user
- Validate individual message structure in `api/anthropic.js:33` — currently only count + array type is checked, not individual message shapes (image blocks = expensive)
- TodoView: wire reminder-type entries from DB instead of localStorage-only (`src/OpenBrain.jsx`, TodoView ~line 597)
- Suggestions filtering: `src/data/suggestions.js` lines 127, 217 prompt for Wi-Fi passwords — these now land in Supabase FTS. Consider removing or tagging those questions.

## Warnings
- ⚠️ `capture()` RPC hardcodes `v_owner_id = '00000000-...-0001'` — all new entries go to this UUID regardless of authenticated user. Verify still present before fixing: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'capture'`.
- ⚠️ `INITIAL_ENTRIES` in `src/OpenBrain.jsx` (top of file, ~line 9) is placeholder data — once DB has 20+ real entries, remove and rely on localStorage/DB only.
- ⚠️ `api/entries.js` fetches up to 500 entries with no URL-level user_id filter (relies on `verifyAuth` + service_role). Safe for single-user; add `&user_id=eq.${user.id}` before multi-user.
- ⚠️ Previous warning about `git push` not run is now stale — all commits are pushed (verified: `git log` shows cfe1e9c at origin/main).
