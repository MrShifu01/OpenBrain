# Incident response runbook

Generic playbook for "something is on fire." For the specific 2026-05-04 DB IO incident, see `Working/2026-05-04-db-io-budget-incident.md` — it's the template this runbook generalises.

## Severity ladder

| Level | Definition | Response time |
|---|---|---|
| **SEV-1** | Total outage. App returns 5xx or won't load. Data loss in progress. | Drop everything. Within 15 min. |
| **SEV-2** | Major feature broken (capture, chat, vault). Users can sign in but core flows fail. | Within 1 hour. |
| **SEV-3** | Degraded but workaround exists. Slow chat, stale enrichment, one cron failing. | Within 4 hours / next working day. |
| **SEV-4** | Cosmetic / single-user. UI glitch, support ticket. | Triage in normal cadence. |

Solo founder pre-launch, but the discipline matters: it forces clarity on whether to wake up vs. wait.

## First 5 minutes — triage

1. **Open the status pages** (in this order — bookmark them):
   - Vercel: <https://www.vercel-status.com>
   - Supabase: <https://status.supabase.com>
   - Google Cloud (Gemini): <https://status.cloud.google.com>
   - Resend: <https://resend-status.com>
   - LemonSqueezy: <https://status.lemonsqueezy.com>

2. **Check Sentry** — is the error spike already visible? What's the message?

3. **Check Vercel Function logs** — `vercel logs <project>` or the dashboard's Logs tab. Most server errors land there before Sentry catches them.

4. **Reproduce locally** if the bug is in product behaviour, not infra. `npm run dev` against prod Supabase project.

5. **Decide**: vendor outage (wait + post status), our bug (revert + fix), or capacity (scale + throttle).

## Vendor-outage playbook

If a vendor's status page is red:

1. **Don't deploy anything.** A retry storm makes it worse.
2. **Disable any cron that hits the affected vendor** (see `Ops/crons.md`).
3. **Post a one-line status to your support channel** (email auto-responder, in-app banner, Twitter): "X is having an outage. Affected: Y. We'll update when it clears."
4. **Watch the vendor's status page**. When green, wait 10 min, then re-enable crons one at a time.

## Our-bug playbook

1. **`git log` the last 5 deploys.** Is the bug in something that just shipped? Roll back via Vercel dashboard → Deployments → Promote a known-good commit.
2. **If no recent deploy is the cause**, capture a reproducible stack trace before fixing.
3. **Reproduce locally**, write the failing test, fix, ship.
4. **Post-mortem within 24h** for SEV-1/SEV-2: file under `Working/<date>-<slug>-incident.md` and reference `Ops/incident-response.md` from it. Cover: timeline, blast radius, root cause, fix, prevention.

## Capacity playbook

1. Open Supabase → Settings → Usage. Are we hitting IO budget, connection pool exhaustion, or storage limit?
2. Open Vercel → Project → Usage. Are we at the function-invocation cap?
3. **Disable IO-heavy crons immediately** (Daily / Hourly / DB Backup / Weekly).
4. **Upgrade plan** if the trigger is pre-launch traffic (`Hobby → Pro` for both Supabase and Vercel).
5. **Don't try to optimise during the fire.** Get back to green, then address the hot query in a follow-up commit (see migration 073 / 074 for the bulk-embed fix template).

## Secret-rotation playbook (suspected leak)

1. **Identify the leaked key** (commit history, log file, third-party tool).
2. **Rotate at the source first** (Supabase / vendor dashboard). Don't update anything in our project until the new key is in hand.
3. **Update Vercel env** for `production`, `preview`, `development`.
4. **Update GitHub Actions secrets** if any workflow uses it.
5. **Update local `.env`** so dev still works.
6. **Force a redeploy** so all serverless functions pick up the new value.
7. **Rotate dependent keys** if any (e.g. webhook secrets the rotated service signs with).
8. **Document the rotation** in this file's history (date, key, reason).

> **Special cases — don't rotate without prep**:
> - `OAUTH_TOKEN_ENCRYPTION_KEY` / `GMAIL_TOKEN_ENCRYPTION_KEY` — rotating breaks every stored OAuth token. Bump version (`*_v2`) instead and force re-auth.
> - `VAPID_PRIVATE_KEY` — rotating invalidates every existing browser push subscription.

## Vault / encryption incident

If a user's vault is reported as "decryption failed with the right passphrase":

1. Check `vault_keys` row directly via Supabase MCP — does `salt`, `verify_token`, `recovery_blob` look intact? `public_key`, `wrapped_private_key` populated?
2. Check `vault_entries` row — is `content` ciphertext (`v1:` prefix) or has it been clobbered?
3. Check the JWT — did `app_metadata` or anything else change? `supabase.auth.refreshSession()` may unstick.
4. If `unwrapPrivateKey` is throwing, see `architecture/security.md` § "phase-2 backfill" — the `MASTER_KEY_USAGES` fix from 2026-05-04 should be deployed.
5. Last resort — wipe `vault_keys` + `vault_entries` for the user and have them set up fresh. **Their existing secrets are gone. Confirm with the user first.**

## Communication during incidents

- **In-app banner** is fastest for SEV-1/SEV-2. Add a one-line `<div>` to `Everion.tsx` with `display:none` toggle via env, deploy.
- **Email blast** via Resend `/api/v1/admin?action=blast`. Use sparingly — one per incident max.
- **Twitter / X** — short status update, one per hour until resolved.
- **Don't promise specific recovery times** unless you control the cause.

## Post-mortem template

```markdown
# <date> — <one-line summary>

## Timeline (UTC)
- 14:23 — Sentry alert fires
- 14:25 — Triaged, identified <vendor> outage / our bug / capacity
- 14:31 — Mitigation applied: <action>
- 15:02 — Verified green
- 15:15 — Banner removed

## Blast radius
Users affected, percentage of traffic, data lost (none / N rows / specific rows).

## Root cause
What failed, and the chain of decisions that allowed it.

## Fix
Commit hash + summary.

## Prevention
What changes (test / monitor / runbook) keep this from recurring.
```

File post-mortems under `Working/<date>-<slug>-incident.md`. Move to `Working/archive/` once resolved.
