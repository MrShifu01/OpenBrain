# Support standard operating procedure

How support requests get triaged, answered, and closed. Built for solo operation; designed to scale to a small team.

## Channels

Inbound paths to support:
1. **In-app feedback button** (`/api/feedback`) — preferred. Captures user_id automatically.
2. **Email** — `support@…` (TODO: forward to christian@). Goes to a Gmail label `Evara/Support`.
3. **Twitter / X DM** — for public-facing complaints. Move to email if substantive.
4. **Slack / Discord** (beta cohort only) — informal; capture issue, redirect to email if it needs a paper trail.

## Triage SLA (solo phase)

| Severity | Definition | Initial response | Resolution target |
|---|---|---|---|
| **S1** — outage / data loss | "I can't sign in" / "my data's gone" | Within 2h business hours, 12h off-hours | Same day |
| **S2** — feature broken | Specific feature failing for a specific user | Within 24h | 7 days |
| **S3** — question / how-to | Usage question, doc gap | Within 48h | N/A (close after answer) |
| **S4** — feature request | Feature idea, "would be nice" | Within 7 days | Triage → roadmap or wontfix |

Define "business hours" generously — this is solo, not a 9-5 — but the tier matters because it determines whether to interrupt your day or batch-process.

## Response template (every reply starts with this)

```
Hi {first_name},

{1-2 sentence acknowledgement of what they reported in their words}

{the action / answer / status}

{ if S2/S3 — close with: } Let me know if that resolves it.
{ if S1 — close with: } I'll follow up once it's fixed.
{ if S4 — close with: } I've added it to the backlog — happy to ping you when it ships.

— Christian
```

Tone: per `Brand/voice-tone.md`. First name. Sign with first name. Don't use "we" if it's just you.

## Common categories

### Auth / sign-in problems
→ Use `Support/account-recovery.md`. Decision tree there covers password reset, lost passphrase (paths A/B), hijacked account.

### Vault problems
→ See `Support/account-recovery.md` § Lost passphrase. The hard email template is there.

### "Where's my data?"
- Confirm user_id, search Supabase for any soft-delete or accidental admin action.
- If they imported via Gmail and entries are missing: check `gmail_sync` queue + provider logs.
- If they restored from a different account: explain the difference and offer account-merge if technically feasible.

### "AI gave me a wrong answer"
- Always triage with the user's permission — ask if they're OK with you looking at the specific question + answer pair.
- Look at retrieval set in PostHog `chat_*` events for that user_id at that time.
- Fix categories: missed retrieval (improve embed/index), bad source (data quality), hallucination (model behavior — escalate to provider settings or tier).

### Billing / subscription
→ See `Legal/pricing-billing.md`. Most issues are LemonSqueezy or RevenueCat receipts. For sandbox/test issues, check `STRIPE_TEST_MODE` env and provider dashboard.

### Privacy / data export request
- Verify identity from registered email.
- For export: dump every user-owned table to JSON, send via secure link (S3 presigned URL or Resend attachment).
- For delete: see `Support/account-recovery.md` § Account deletion request.

### Abuse report
- See `Support/abuse-moderation.md`.
- Don't act unilaterally on an unverified claim; investigate first.

## Tools / where to look

| Tool | What it tells you |
|---|---|
| **Settings → Admin → Support CRM** | User profile, tier, current-month usage, last 50 audit events. First stop. |
| **Supabase MCP `execute_sql`** | Direct DB queries when CRM isn't enough. |
| **Supabase logs (`get_logs`)** | API failures, auth errors. |
| **PostHog** | What the user did before the issue. |
| **Sentry** | Stack traces if they hit an error boundary. |
| **Resend dashboard** | Email deliverability. |
| **LemonSqueezy / RevenueCat dashboards** | Billing receipts, subscription state. |
| **Vercel function logs** | Specific endpoint failures. |

## Auditing your own actions

Any time you touch a user's account on their behalf:
1. Log to `audit_log` with `actor_id=<your admin uuid>`, `action='admin_<verb>'`, `metadata={ target_user_id, reason }`.
2. Tell the user what you did in the reply.

Never silently modify a user's data. The user owns their account; we're guests.

## Closing tickets

- Reply with the resolution.
- Tag the email/thread (Gmail label `closed`).
- For S1/S2: write a one-line postmortem in `EML/Audits/incidents-log.md` (TODO: create on first incident).
- For S4 that's promoted to backlog: add to `EML/LAUNCH_CHECKLIST.md` or `EML/BRAINSTORM.md` with a tag like `(from support 2026-05-04)`.

## Escalation (when team grows beyond solo)

When a team exists:
- L1 = anyone covering inbox; handles S3/S4 + collects facts on S1/S2.
- L2 = engineer on call; handles S1/S2 fixes.
- Founder reads every S1 + every churn-related S4. Don't lose direct touch with users.

For now: solo. All tiers come to Christian.

## Saved replies

Maintain a `Support/saved-replies.md` (TODO) with the canned responses for the top 10 categories. Don't paste from there blindly — always personalize the salutation + body.

## References

- `Brand/voice-tone.md` — how to write
- `Support/account-recovery.md` — auth/vault scenarios
- `Support/faq.md` — public FAQ (some support questions should land here as docs)
- `Support/abuse-moderation.md` — abuse / TOS violations
- `Legal/pricing-billing.md` — billing / refund policy
- `Ops/incident-response.md` — when an issue is bigger than one user
