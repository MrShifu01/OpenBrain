# Disaster recovery

What's recoverable, what's lost, and the exact restore steps for each scenario. Drill this **before** you need it — an untested DR plan is a DR fantasy.

## Recovery point objective (RPO) + recovery time objective (RTO)

| Asset | RPO | RTO | Source of recovery |
|---|---|---|---|
| Database (`public` schema) | 24h (daily backup at 03:17 UTC) | 1–2h (manual restore) | GitHub Releases — `db-backup-YYYY-MM-DD` asset |
| User-uploaded files | N/A — files are stored in Supabase Storage, covered by Supabase point-in-time recovery (Pro plan only) | Pro: minutes; Hobby: not recoverable | Supabase dashboard → Settings → Backups |
| Vault entries (encrypted) | Same as DB above | Same as DB | DB backup, then user re-unlock with passphrase / recovery key |
| Source code | Real-time | Minutes | GitHub repo + Vercel deploy history |
| Secrets / env vars | Manual snapshot when changed | 15 min | Vercel project + GitHub Actions secrets dashboard |

Bold caveat: **on Hobby plan, Supabase point-in-time recovery is OFF**. The only DB backup we have is the GitHub Actions `db-backup` workflow. If that workflow is failing silently, we have no recovery path.

## Scenarios

### S1 — DB corruption / accidental DELETE

1. Stop the bleeding: disable any cron that writes (`gh workflow disable "Hourly Cron"` etc.).
2. Identify the corrupted row(s) — `audit_log` is your friend (see migration 057+).
3. If a single row: restore from the latest `db-backup-*.sql` GitHub Release asset by `psql` import into a scratch DB, find the row, INSERT it into prod.
4. If a table: same approach but bulk INSERT.
5. If schema-level: full restore (S2).
6. Re-enable crons.

### S2 — Full DB loss

Worst case. Steps:

1. **Provision a new Supabase project** (don't try to recover the old one — start clean).
2. **Apply every migration** in `supabase/migrations/` in order. Use `supabase db push` or `apply_migration` MCP.
3. **Restore the latest `db-backup-*.sql`** from GitHub Releases.
4. **Update env vars** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`) on Vercel + repo secrets.
5. **Redeploy** so the app points at the new project.
6. **Validate** by signing in and checking that entries / vault / settings load.
7. **Communicate** — every user needs to know: signins continue to work because Supabase Auth is in the same project (auth-then-data). If auth was lost too, send a "reset your password" email to every row in `auth.users`.

Estimated RTO: 4–8h depending on backup size.

### S3 — Vercel project deleted / suspended

1. Create a new Vercel project linked to the same GitHub repo.
2. Copy env vars from the secrets-snapshot (you DO have one, right? See checklist below.)
3. Deploy.
4. Update DNS to point at the new project.
5. Restore the cron secrets in repo Actions secrets so workflows fire against the new endpoint.

### S4 — User reports vault wipe / lost passphrase

The user owns the passphrase + recovery key. **We cannot recover encrypted vault content without one of them.**

1. If user has the **passphrase**: they unlock normally. Trivial.
2. If user has the **recovery key** but lost the passphrase: they unlock via the recovery flow (`/api/vault?action=use-recovery-key`).
3. If user has **neither**: their existing vault entries are mathematically unrecoverable. Steps:
   - Confirm with user in writing: "we'll wipe your vault, you start over." Get the email.
   - Wipe `vault_keys`, `vault_entries`, `brain_vault_grants` for the user (see `Working/2026-05-04-db-io-budget-incident.md` § "wipe SQL").
   - User goes through vault setup again with a fresh passphrase + new recovery key.
   - Tell them to **download a backup** (Vault → ↓ Backup) once a month so this never happens again.

## Pre-launch DR checklist

- [ ] **Test the DB backup restore** — pull the latest `db-backup-*.sql`, apply to a scratch Supabase project, check row counts match prod. Do this once before launch and after any schema change.
- [ ] **Snapshot env vars** to a 1Password vault or equivalent (secrets, not just names). Update on every rotation.
- [ ] **Snapshot DNS records** so you can rebuild the zone from scratch if the registrar locks the domain.
- [ ] **Document the GitHub repo's collaborators / org permissions** — losing access to the repo IS a disaster.
- [ ] **Test the Vercel rollback flow** — promote an old deploy from the dashboard. Confirm app keeps working.
- [ ] **Verify `db-backup` workflow has run successfully in the last 24h** before any high-risk change (schema migration, paid-plan downgrade, repo restructure).

## What we explicitly DON'T cover

- **No multi-region / hot-standby**. Solo pre-launch app.
- **No cross-cloud DR**. If both GitHub and Supabase are down for the same window, we're offline. Rare enough not to engineer for.
- **No automated DR drills**. Schedule one manually quarterly post-launch.
