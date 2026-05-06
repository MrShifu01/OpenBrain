# Cron + workflow runbook

Every scheduled job that runs on this project, what it does, what failure looks like, and what to do when it breaks. All crons live in `.github/workflows/*.yml` and target Vercel function endpoints with `Authorization: Bearer ${CRON_SECRET}`.

> **Reference**: `architecture/cron.md` covers the design decisions (why GitHub Actions + Vercel, not Vercel Cron). This file is the runbook.

## Active crons

### Daily Cron
- **File**: `.github/workflows/cron-daily.yml`
- **Schedule**: `0 4 * * *` (04:00 UTC daily)
- **Endpoint**: `/api/cron/daily` (currently routed via `/api/v1`)
- **Does**: enrichment sweep (parse/insight/concepts/persona/embed) for any pending entries; persona-fact decay; admin daily digest email; Gmail re-sync for opted-in users.
- **Time budget**: 240s shared across all brains (see `api/_lib/enrich.ts:enrichAllBrains`).
- **Failure mode**: workflow fails with red X on the GitHub Actions run. Check logs for the specific step.
- **Common failures**:
  - DB IO budget exhausted → see `Working/2026-05-04-db-io-budget-incident.md`. Disable workflow until recovery.
  - Gemini 429 (rate limit) → enrichment retries with backoff; usually self-heals next run.
  - Embedding dim mismatch → check `embedding_status='failed'` rows; usually a config drift between providers.

### Hourly Cron
- **File**: `.github/workflows/cron-hourly.yml`
- **Schedule**: `0 * * * *` (top of every hour)
- **Endpoint**: `/api/cron/hourly`
- **Does**: due-reminder push notifications; expiry-document warnings (T-30/T-7/T-1); short embedding-pending sweep capped at 30 entries.
- **Time budget**: 300s.
- **Failure mode**: missed reminder/push for users with due items in the past hour. Replays on next firing — at-most-one-hour delay.
- **Common failures**:
  - VAPID push delivery fail → check `VAPID_*` env vars not rotated.
  - Cron secret mismatch → 401 from Vercel; rotate `CRON_SECRET` in both repo + Vercel together.

### DB Backup
- **File**: `.github/workflows/db-backup.yml`
- **Schedule**: `17 3 * * *` (03:17 UTC daily — offset from other crons to spread IO)
- **Does**: `pg_dump` of `public` schema + upload as a private GitHub Release asset. 90-day retention.
- **Failure mode**: red X on workflow. **Do not ignore** — without backups the disaster recovery path is broken (see `Ops/disaster-recovery.md`).
- **Common failures**:
  - `postgresql-client-17` install failure → action runner image drift. Pin a specific runner version.
  - Timeout on dump → DB is too big OR pooler is slow. Move to a direct connection if needed.

### Weekly roll-up
- **File**: `.github/workflows/weekly-roll-up.yml`
- **Schedule**: `0 6 * * 1` (Mon 06:00 UTC)
- **Does**: aggregates Sentry + PostHog + Vercel + Lighthouse + e2e pass-rate from the past 7 days; emails a single HTML digest via Resend.
- **Manual run**: `workflow_dispatch` with `dry_run: true` logs the body to stdout instead of sending.
- **Failure mode**: silent — you just don't get the Monday email. Check Actions tab if a Monday goes by with no inbox digest.

### Test Push
- **File**: `.github/workflows/test-push.yml`
- **Schedule**: manual only (`workflow_dispatch`)
- **Does**: sends one Web Push to `ADMIN_EMAIL`'s subscription so you can verify VAPID flow without waiting for a real reminder.

### CI / E2E / Lighthouse
- **Files**: `.github/workflows/ci.yml`, `e2e.yml`, `lighthouse.yml`
- **Schedule**: on every push / PR
- **Failure mode**: blocks merge. Fix the failing test before merging.

## Disable / re-enable

```bash
# Disable (ops emergency, e.g. DB unhealthy)
gh workflow disable "Daily Cron"
gh workflow disable "Hourly Cron"
gh workflow disable "DB Backup"
gh workflow disable "Weekly roll-up"

# Re-enable (after recovery)
gh workflow enable "Daily Cron"
gh workflow enable "Hourly Cron"
gh workflow enable "DB Backup"
gh workflow enable "Weekly roll-up"
```

`gh workflow list` shows current state of every workflow.

## Sequencing rule for re-enable after a DB incident

1. Confirm IO budget > 20% (Supabase dashboard → Settings → Usage)
2. Apply any pending migrations (e.g. 073/074 from the IO-budget incident)
3. Re-enable **Hourly Cron first**, watch IO for an hour
4. Re-enable Daily Cron, watch for 24 hours
5. Re-enable DB Backup last (it dumps the live DB and is the most IO-heavy single operation)
6. Re-enable Weekly roll-up — runs Monday only, low impact

## Adding a new cron

1. Decide if it belongs as a GitHub Actions cron (visible, free, retry semantics under your control) or in-app (lower latency for user-triggered work).
2. Add the workflow to `.github/workflows/`.
3. Add an endpoint to an existing `api/*.ts` (12-function cap — never add a new file).
4. Verify the endpoint checks `Authorization: Bearer ${CRON_SECRET}` first.
5. Document the new cron in this file with: schedule, what it does, time budget, failure mode.
6. Manually trigger it once via `workflow_dispatch` to confirm it works before letting the scheduler take over.
