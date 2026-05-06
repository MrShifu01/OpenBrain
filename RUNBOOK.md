# Everion Mind — Operational Runbook

> When the app's broken at 2am, this is the file you open first.
> Five most-likely failures, in priority order, plus a rollback procedure.

---

## 1 · "Capture is failing for everyone"

**Symptoms:** users hit `/api/capture` and get 5xx. Sentry spikes. Capture
button spinner hangs.

**First checks (in order, ~2 min each):**

1. Vercel functions dashboard → `api/capture` recent invocations.
   - Is it timing out? Hobby plan caps at 60s; `vercel.json` requested 300s
     but Pro is required. If Hobby, function timed out.
   - Is it 401? Auth/JWT issue — see #4.
2. Supabase logs (`mcp__claude_ai_Supabase__get_logs` service=`api`):
   - PostgREST 5xx? RLS or schema regression — see "Database changed
     unexpectedly" below.
   - Connection refused? Supabase region outage. status.supabase.com.
3. Gemini API status (https://status.cloud.google.com → "Generative
   Language API"). If down, capture works but enrichment is silent
   background and shouldn't block the request — confirm the failing
   step in Sentry.

**If it's a Vercel timeout on Hobby:** upgrade to Pro (one click,
$20/mo) or temporarily revert `maxDuration` in `vercel.json`.

**If it's Supabase:** wait or fail-over (we don't have a fail-over;
status page is the truth).

**If it's a recent deploy:** rollback (see bottom of this file).

---

## 2 · "Chat just stopped working"

**Symptoms:** chat replies show errors, hang, or return empty.

**First checks:**

1. Sentry → group by error message. The friendly errors (e.g. "We
   couldn't reach the server") will be present but the underlying
   error is in the breadcrumb / extra.
2. `api/llm` logs in Vercel → look for upstream provider 4xx/5xx.
3. Provider status pages:
   - Gemini: https://status.cloud.google.com
   - Anthropic: https://status.anthropic.com
   - OpenAI: https://status.openai.com
   - Groq: https://groqstatus.com
4. AI Gateway / model routing — `GEMINI_API_KEY` env var present in
   Vercel? Was it just rotated? `vercel env ls` to confirm.

**If a single provider is down:** push a comms update via the in-app
banner OR rely on BYOK users to swap providers themselves. Most
users don't know which provider answered them.

**If all providers are 5xx:** rate-limit hit. Check Upstash dashboard
for the `/api/llm` budget. If exhausted, raise the budget in
`api/_lib/rateLimit.ts` defaults or wait for the window.

---

## 3 · "Stripe webhook is silently dropping events"

**Symptoms:** users paid but their tier didn't upgrade. Stripe logs
show webhook deliveries succeeded (200) but DB never updated.

**First checks:**

1. Vercel logs for `/api/user-data?resource=stripe-webhook` → any
   error logs around `[stripe-webhook]`?
2. Confirm `STRIPE_WEBHOOK_SECRET` matches the Stripe dashboard
   endpoint secret. Mismatch → all events fail signature verification
   silently before reaching the body.
3. Look for "duplicate" log lines (`dropping duplicate event`). If
   ALL recent events are duplicates, the Upstash event-ID dedup may
   be misconfigured or storing dead keys — flush the Upstash
   `stripe:event:*` keys.
4. Check `user_personas` for the customer's `stripe_customer_id` —
   is the row present? If absent, the PATCH would have updated zero
   rows. The webhook should be paired with a manual reconcile via
   Stripe customer ID.

**Recovery:** in Stripe dashboard, find the relevant event and click
"Resend." Idempotency dedup means re-sending is safe.

---

## 4 · "Logged-in users keep getting kicked to the login screen"

**Symptoms:** session bounces every page reload. Sentry sees
`401 Unauthorized` on auth-required endpoints.

**First checks:**

1. Did Supabase keys rotate? (`SUPABASE_JWT_SECRET` or `SUPABASE_ANON_KEY`)
   If yes, every existing session is invalidated. Users must sign in
   again — communicate via the in-app banner.
2. Browser clock drift — JWTs reject if `iat` is in the future. Rare
   but happens on Windows hosts. The fix is on the user side; comms
   only.
3. Service-role key issue — `api/_lib/verifyAuth.ts` uses service
   role to verify JWTs. If `SUPABASE_SERVICE_ROLE_KEY` is empty in
   Vercel (e.g., accidental delete), every authed request 401s.
   Fix: `vercel env add SUPABASE_SERVICE_ROLE_KEY production` and
   redeploy.

---

## 5 · "Database changed unexpectedly / RLS denying everything"

**Symptoms:** read endpoints return 403, capture writes fail with
"new row violates row-level security policy."

**First checks:**

1. `mcp__claude_ai_Supabase__execute_sql`:
   `SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename;`
   — confirm the policy you expect exists.
2. Look at the latest migration in `supabase/migrations/` — any DROP
   POLICY without a CREATE replacement?
3. RLS audit script lives in shell history during pre-launch (see
   commit `8f69523` and migration `053`). Re-run for the affected
   table.

**Recovery for an accidental policy drop:**

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <table>_owner_rw ON public.<table>
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

If a service-role-only flow broke instead, restore via the migration
template in `supabase/migrations/053_rls_audit_hardening.sql`.

---

## Rollback procedure (Vercel)

When a recent deploy is the suspect, rolling back is the cheapest
test. Vercel keeps the last ~24h of immutable deployments hot.

1. Open https://vercel.com/<your-team>/everionmind/deployments
2. Find the previous Production deployment that was healthy. Hover
   the row → click the `…` menu → **Promote to Production**.
3. Within ~10 sec, the apex domain (everion.smashburgerbar.co.za)
   serves the older bundle.
4. Confirm: load the site with cache cleared
   (`Ctrl+Shift+R` / hard reload). Check `<script src=>` in
   index.html — it should match the older deployment's hash.

**After rollback, do NOT just leave it.**

- Open a fix-forward PR for what caused the regression.
- If the rollback was for a database migration, the rollback only
  swaps the front-end. Migrations are forward-only and persist —
  test `migrations/<n>_rollback.sql` exists OR plan a compensating
  migration.
- Update Sentry / PostHog tags so you can tell pre/post-rollback
  errors apart in dashboards.

**If rollback doesn't fix it:** the bug is in data, not code. Check
recent migrations and recent webhook activity.

---

## DB-restore procedure (DIY pg_dump backups)

**When to use this:** the database has been corrupted, a destructive
migration ran in production, or rows are missing and you need to roll
back to yesterday's state. The `db-backup.yml` GitHub Action runs daily
at 03:17 UTC and stores 30 days of dumps as private GitHub Releases
tagged `backup-YYYY-MM-DD`.

**You need:** the `gh` CLI authenticated to this repo, `psql` (Postgres
17 client), and a fresh empty Supabase project to restore *into*. Never
restore over production directly — restore to a new project, verify it
looks right, THEN repoint the app.

**Steps:**

1. List available backups:
   ```bash
   gh release list --limit 50 --json tagName --jq '.[] | select(.tagName | startswith("backup-")) | .tagName'
   ```

2. Download the dump you want (e.g. yesterday's):
   ```bash
   gh release download backup-2026-04-27 --pattern '*.sql.gz'
   ```

3. Spin up a fresh Supabase project (dashboard → New Project) for the
   restore target. Don't restore into staging, that already has its own
   shape. Don't restore into production until you've verified the dump.

4. Apply the dump:
   ```bash
   gunzip -c db-2026-04-27.sql.gz | psql "$NEW_PROJECT_DB_URL"
   ```

5. Verify a known row exists:
   ```sql
   SELECT count(*) FROM entries;
   SELECT count(*) FROM brains;
   ```
   Counts should roughly match production-at-backup-time.

**What the dump does NOT contain:**

- The `auth` schema (Supabase-managed). Restored project has no users —
  if this is full disaster recovery, users will need to re-sign-up. For
  partial restore (e.g. recover deleted entries) you'd dump affected
  tables from the new project and re-INSERT into prod.
- Realtime publication state. Re-add the `entries` table to
  `supabase_realtime` after restore (see migration `047`).
- RLS policies will exist but won't match any user IDs unless you also
  restore the `auth.users` rows separately.

**For full disaster recovery you want Supabase Pro.** This DIY is a
stop-gap, useful for "I dropped the wrong table" rather than "the
project got nuked".

---

## When you can't tell which one of the above is happening

Open Sentry first (most signal per second), then Vercel function
logs, then Supabase logs. Pattern-match against the sections above
in order. Don't dig into a fix until you've identified which
section it's in.
