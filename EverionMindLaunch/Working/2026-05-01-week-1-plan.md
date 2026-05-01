# Week 1 — DECIDE & PROVISION

**Window: Fri 2026-05-01 (today, day 1) → Thu 2026-05-07 (day 7).**
**Theme: every operational dependency for the 30-day arc is paid, provisioned, and green by Thursday evening. Plus the highest-leverage retention input (3-stranger onboarding test) before another line of new code.**

This week is about *not building*. The schedule's macro arc says week 1 = "DECIDE & PROVISION + ruthless pruning of nav". Pruning shipped Day 1 (commit `f9a2153`); the rest of the week is operations + research + zero-feature work.

If a task this week doesn't move *trademark verified, dashboards paid, dev accounts active, exposed keys rotated, alerts firing, 3 strangers tested, dashboards co-admined* forward — push it.

---

## North star for the week

> By Thu evening, every dashboard is paid + co-admined, every key has been rotated, alerts are firing, and I know from 3 strangers (not me) where the onboarding actually breaks.

---

## Hard outputs

| # | Output | Verifies how |
| - | ------ | ------------ |
| 1 | Trademark on "Everion Mind" verified clean OR brand pivot decision | USPTO TESS + WIPO Madrid Monitor + ZA-CIPC search clean for class 9 (software) |
| 2 | Vercel Pro paid + active | Vercel dashboard shows Pro tier, `maxDuration: 300` no longer warned in build |
| 3 | Supabase Pro paid + active | Backups page shows daily snapshots; 8 GB DB cap visible |
| 4 | Google Play Developer account active | $25 paid, account email confirmed, console accessible |
| 5 | All exposed dev-session keys rotated | Resend, Groq, Upstash REST, CRON_SECRET, VAPID private — all replaced in Vercel env |
| 6 | Sentry 3-rule alert config live | Error-spike, new-issue, slow `/api/llm`+`/api/capture` p95 — all firing on test |
| 7 | DIY DB backup workflow shipping | At least one `backup-YYYY-MM-DD` GitHub release tagged |
| 8 | Co-admin on 7 dashboards | Vercel, Supabase, Sentry, PostHog, Resend, Upstash, GitHub all show ≥2 admins |
| 9 | Weekly roll-up email shipping (or dry-run verified) | First Mon-morning Resend email lands in inbox with real numbers |
| 10 | 3 stranger onboarding sessions complete | Recordings + 1-page polish-notes doc lands in `Audits/` |

---

## Daily blocks (PST)

### Fri 2026-05-01 (today, day 1) — Trademark + dashboards day

**Goal:** the highest-blocking item (trademark) is resolved by lunch. Every paid dependency has a card on file by end of day.

- 09:00–11:00 — **Trademark search.** Three databases:
  1. USPTO TESS (https://tmsearch.uspto.gov) — class 9 (software). Exact match + phonetic match.
  2. WIPO Madrid Monitor (https://www3.wipo.int/madrid/monitor) — international filings.
  3. ZA-CIPC (https://iponline.cipc.co.za) — South Africa class 9.

  **If clean:** continue. **If conflict:** STOP. Decide same-day: rebrand or proceed with risk acceptance. The cost of finding out at month 3 is 100× what it costs to find out at day 1.

- 11:00–12:00 — **Vercel Pro upgrade** ($20/mo). https://vercel.com/dashboard/billing. Confirm active immediately — `vercel.json` already requests `maxDuration: 300` and Hobby will silently cap to 60s.
- 13:00–14:00 — **Supabase Pro upgrade** ($25/mo). https://supabase.com/dashboard/project/wfvoqpdfzkqnenzjxhui/settings/billing. Confirm Backups page shows daily entries within 24h.
- 14:00–15:00 — **Google Play Developer enrollment** ($25). https://play.google.com/console/signup. Approval is usually instant; can be 24h. If still pending Sat morning, escalate to "PWA-only contingency for day 30" planning.
- 15:00–16:00 — **Customer support email forward.** Set up `support@everion.smashburgerbar.co.za` → forwards to `stander.christian@gmail.com`. (When `everionmind.com` cuts over week 2, re-do for the new domain.)
- 16:00–18:00 — **Already-shipped audit:** confirm today's commits are deployed (`f9a2153` nav fix + `052db23` PostHog funnel). Verify `VITE_FEATURE_*` env vars in Vercel prod are NOT set to `"true"` (per the nav fix's success condition).

**Done means:**
- Trademark search results recorded in MEMORY.md (clean OR conflict-decision).
- 3 paid receipts in inbox (Vercel, Supabase, Google Play).
- Support email forward tested with a smoke-send from another address.
- Vercel prod env confirmed: feature flags off where they should be off.

**Tripwire:** trademark conflict on "Everion Mind" → halt all marketing copy work (PH "upcoming" submission, weekly digests, beta invites all reference the brand). Decide rebrand vs. risk-acceptance before Sat.

---

### Sat 2026-05-02 — Keys + alerts + backups

**Goal:** every secret that shouldn't be where it is right now isn't anymore. Sentry tells you when things break. The DIY backup workflow runs once.

- 09:00–10:30 — **Key rotations.** Each takes 5-10 min: generate new in dashboard → update Vercel env → trigger redeploy → verify endpoints still work.
  - Resend (https://resend.com/api-keys)
  - Groq (https://console.groq.com/keys)
  - Upstash REST token (https://console.upstash.com/account)
  - `CRON_SECRET` (random 32-byte hex; update in `.github/workflows/*.yml` cron headers + Vercel env)
  - VAPID private key (`web-push generate-vapid-keys`; update Vercel env `VAPID_PRIVATE_KEY`)

  **Don't rotate Supabase service-role or anon keys.** Rotating signs everyone out and breaks signed magic-link tokens already in flight. Only rotate Supabase keys if there's a confirmed leak.

- 11:00–12:00 — **Sentry alerts (3 rules).** https://sentry.io/settings/projects/everion/alerts. Create:
  1. **Error-rate spike** — > 10 errors/min for 5 min → email + Slack (if configured).
  2. **New issue type** — first occurrence of any unique fingerprint → email.
  3. **Slow API p95** — `transaction.op === "http.server"` AND `transaction.name in ("/api/llm","/api/capture")` AND p95 > 5s → email.

  Detailed click-by-click in `docs/launch-runbook-alerts-and-dns.md`.

- 13:00–14:00 — **DIY backup workflow.** Two steps:
  1. Add `SUPABASE_DB_URL` to GH repo secrets. Get URI from Supabase → Project Settings → Database → Connection string → URI. **Use Session pooler port 5432** (NOT transaction pooler 6543 — it doesn't support `pg_dump`).
  2. Trigger first run: `gh workflow run db-backup.yml`. Wait ~5 min. Verify with `gh release list` — should see `backup-2026-05-02` tag.

- 14:00–15:00 — **SSL + DNS smoke check on current production host.** `https://www.ssllabs.com/ssltest/analyze.html?d=everion.smashburgerbar.co.za` should be grade A. `nslookup everion.smashburgerbar.co.za 1.1.1.1` should show A + AAAA records. Both can be re-checked next Friday after the domain cutover; doing it now establishes the baseline.

**Done means:**
- 5 keys rotated, all endpoints still functional (smoke-test capture + chat + magic-link).
- 3 Sentry rules live, tested by triggering a synthetic error.
- 1 backup release on GitHub, confirmed by `gh release view backup-2026-05-02`.
- SSL grade A confirmed for current domain.

---

### Sun 2026-05-03 — Stranger recruitment + sessions 1-2

**Goal:** Recruit 3 stranger testers. Run 1-2 sessions today.

> **The checklist's #1 "this week" item.** Friends and family who haven't seen the app. Have them screen-record while you watch silently, no coaching. **Single highest-value pre-launch task.**

- 09:00–11:00 — **Recruit.** DM 8-12 people who haven't seen the app. Script:

  > "Building something — would you spend 30 min testing it? I just need you to screen + voice record while you try, I won't say a word. Coffee on me. This week, ideally Sun/Mon."

  Aim for 3 yeses. Bias toward people who'll be honest, not polite. Avoid: anyone who's already heard the elevator pitch (their cognition is poisoned).

- 13:00–14:00 — **Session 1.** Tools: Loom or QuickTime screen recording with internal mic. Setup their device (signed-out browser pointing at production). Then — say nothing. Watch. Time to first capture, time to first ask, count of confused moments.

- 15:00–16:00 — **Debrief session 1.** 10-min freeform call after the recording. Ask:
  - What were you trying to do at minute 3?
  - Where did you get stuck?
  - What did you expect to happen that didn't?

- 16:00–17:00 — **Session 2** (if you got 2 yeses for today).

- 17:00–18:00 — Notes pass. Don't analyze yet — just dump observations into `Audits/2026-05-03-stranger-test-day-1.md` chronologically. Patterns surface tomorrow.

**Done means:**
- 1-2 stranger sessions recorded.
- Raw notes dumped into Audits/.

**Tripwire:** if no one says yes by 14:00, push session 1 to Mon and accept 2 sessions total instead of 3. **Don't drop to 0.**

---

### Mon 2026-05-04 — Stranger session 3 + distill

**Goal:** finish the stranger arc. Distill 3 sessions into 1 page of polish notes.

- 09:00–11:00 — **Session 3.** Same protocol.
- 11:00–13:00 — **Debrief + raw notes for session 3.**
- 14:00–17:00 — **Distill all 3 into a polish-notes doc.** Drop into `Audits/2026-05-04-stranger-test-distilled.md`. Format:
  - **Top 3 confusion points** (verbatim quotes if possible)
  - **Top 3 surprises** (where their mental model diverged from yours)
  - **Top 3 wow moments** (where they leaned in)
  - **Recommended week 2 polish targets** (what to fix Sat 05-09)
- 17:00–18:00 — Push the polish notes to MEMORY.md as a project memory so week 2 has it as durable context.

**Done means:**
- 3 sessions complete OR 2 + a documented "couldn't get a third".
- 1 distilled audit doc archived.
- Recommended polish targets fed into week 2 onboarding-polish day (Sat 05-09).

---

### Tue 2026-05-05 — Co-admin every dashboard (bus factor)

**Goal:** if you're hit by a bus on day 60, someone else can keep the lights on.

> Per checklist line 456: ~10 min per provider × 7 in scope = ~70 min total today.

Add a second admin (your partner / a trusted contractor / a co-founder if you have one) to:

- Vercel team — vercel.com/teams/<team>/settings/members → Invite
- Supabase organization — supabase.com/dashboard/org/<org>/team → Invite
- Sentry — sentry.io/settings/<org>/members → Invite Member
- PostHog — app.posthog.com/organization/members → Invite
- Resend — resend.com/team → Invite
- Upstash — console.upstash.com/account/team → Invite
- GitHub repo — repo Settings → Collaborators → Add

**Defer to week 4 (after billing operator setup):**
- LemonSqueezy team
- RevenueCat team
- App Store Connect team
- Play Console users

For each: send the invite, confirm they accept, document who has access where in `Audits/2026-05-05-dashboard-access.md`. The doc itself is bus-factor — if you forget where you added someone, the doc remembers.

- 13:00–17:00 — **Slack block.** This is a rare 4-hour gap; use it for whatever spilled from Sat-Mon. If everything's green, start the weekly roll-up email setup early (Wed work).

---

### Wed 2026-05-06 — Weekly roll-up email setup

**Goal:** by Mon morning of week 2, you receive an email with last-week's numbers (errors, DAU, captures, perf, e2e) so you don't have to log into 5 dashboards before coffee.

> Per checklist lines 100-127. ~3-4 hours of focused work.

- 09:00–10:30 — **Add 8 GH Actions secrets.** Settings → Secrets and variables → Actions:
  - `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
  - `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`
  - `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`
  - `RESEND_API_KEY` (duplicate from Vercel env)
  - `WEEKLY_REPORT_TO` (your email)

- 10:30–13:00 — **Wire `scripts/weekly-roll-up.ts`.** Per checklist line 117. Pulls last-7d metrics, composes one HTML email, sends via Resend. If the script doesn't exist yet, write it from scratch — 200 lines of TS calling the four APIs sequentially.

- 14:00–15:30 — **Wire `.github/workflows/weekly-roll-up.yml`** with `cron: "0 6 * * 1"` (Mon 06:00 UTC) + `workflow_dispatch` for manual triggers.

- 15:30–17:00 — **Dry-run** the first send with stdout-only mode (script logs the composed email instead of sending). Eyeball the numbers. Once the format looks right, flip to live send.

- 17:00–18:00 — **Manual trigger** the first live send (`gh workflow run weekly-roll-up.yml`). Confirm receipt.

**Done means:**
- 8 secrets added.
- Script + workflow committed.
- First live email landed in inbox with real numbers.

---

### Thu 2026-05-07 — Slack day + week-1 retro

**Goal:** anything that slipped from Mon-Wed lands here. End the week with a reconciled list of what's green vs amber for kicking off week 2 Friday.

- 09:00–13:00 — **Slack block.** Pick from the open list:
  - Resend SPF/DKIM/DMARC records (deferred to week 2 anyway after domain cutover; do a baseline check today)
  - 3-stranger session 3 if Mon's slipped
  - Weekly roll-up tuning if Wed's looked off
  - Co-admin invites that haven't been accepted yet

- 14:00–16:00 — **Pre-week-2 readiness check.** Walk through every "Done means" from this week. Anything red? Decide: fix Thu evening, push to week 2's Friday slack, or accept-the-amber and document.

- 16:00–18:00 — **Week 1 retro.** Write `Working/2026-05-07-week-1-retro.md`. Sections:
  - What shipped vs. what slipped
  - What surprised me (about ops, about the stranger test, about the funnel)
  - One thing to change in week 2's plan
  - Stop-or-go decision for the day-30 launch (still on track? PWA-only contingency probable? brand pivot needed?)

**Done means:**
- Retro doc written, linked from MEMORY.md.
- All week-1 hard outputs reconciled.
- Week 2 starts Friday with no week-1 carry-forward (or a documented one).

---

## Risk register for the week

| Risk | Likelihood | Mitigation |
| ---- | ---------- | ---------- |
| Trademark conflict on "Everion Mind" | Low-medium | Decide rebrand vs. risk-acceptance same-day Fri. **Schedule reset is real if rebrand needed.** |
| Google Play Dev approval > 24h | Low | If still pending Sun, plan for PWA-only-on-day-30 contingency in week 4 |
| Stranger recruitment fails (< 3 yeses) | Medium | Drop to 2 sessions; prioritize the most-different demographics; OR push 1 session into next weekend |
| Sentry alerts misconfigured (false-positive flood) | Low | Soak each rule for 24h; tune thresholds before relying on them |
| Co-admins don't accept invites | Low | Send invites Tue morning; nudge Wed if not accepted; document who's responsive |
| Weekly roll-up email API tokens fail (rate limits, scope mismatches) | Medium | Dry-run mode catches this. Allocate the full Wed afternoon — if it slips to Thu, fine |
| Stranger test reveals fundamental UX problem (e.g., onboarding broken on Android) | Medium-high | Re-prioritize week 2: the polish day (Sat 05-09) gets the worst-case focus. Brain Feed v0 gets cut to 1.5 days |

---

## Items deferred from this week (intentionally)

These are checklist P0/P1 but live in week 2-4, not week 1:

- Domain cutover to `everionmind.com` — week 2 (Fri 05-08)
- LemonSqueezy + RevenueCat operator setup — week 2 (Thu 05-14)
- Onboarding aha-in-60s polish — week 2 (Sat 05-09)
- Brain Feed v0 / Streak / Cmd+K — week 2 (Mon-Thu)
- Android QA + Play Console submission — week 3
- Lighthouse + E2E green + cross-browser QA — week 4
- Welcome email cross-client testing — week 4
- Subscription cancellation E2E — week 4
- DB backup restore rehearsal — week 4 (assumes Pro is on)
- Legal review of Privacy + ToS — week 4
- Co-admin on LS/RC/App Store/Play — week 4 (after they're set up)

---

## Verification at end of week

Open the dashboard at `localhost:5174`. The "Working" group shows:
- Week 1 plan + retro
- Week 2 plan + 4 sub-specs (already shipped)
- Week 3 plan + 2 sub-specs (already shipped)
- Beta-phase ops (already shipped)

The "Audits" group shows:
- Stranger test day-1 raw notes
- Stranger test distilled
- Dashboard access doc

The actual dashboards show:
- Vercel Pro tier active
- Supabase Pro tier active + 1+ daily backup visible
- Sentry alerts page: 3 rules in "Active" state
- 1 GitHub release tagged `backup-YYYY-MM-DD`
- Inbox: 1 weekly roll-up email received this week

If all are true, week 1 succeeded. Then move to week 2 (domain + onboarding + funnel + features).
