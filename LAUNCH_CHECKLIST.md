# Everion Mind — Public Launch Checklist

Project-specific, prioritized for solo dev shipping a public-scale product.

**How to use:** Work through P0 first (blocks launch). P1 is the strong-recommendation tier — get there before opening signups beyond closed beta. P2 is the post-launch backlog. Update the status icons as you go.

**Status icons:** ✅ done · 🟡 partial · ❌ missing

---

## P0 — Blocks launch (must have)

### Infrastructure

- [ ] **Vercel Pro upgrade** ❌
  Currently on Hobby (12-function cap, 100 GB bandwidth, 60s function timeout). `vercel.json` already configures `maxDuration: 300` on `gmail.ts` / `llm.ts` / `user-data.ts` — those will time out at 60s on Hobby. Upgrade before launch ($20/mo).
- [ ] **Custom domain SSL + DNS verified** 🟡
  `everion.smashburgerbar.co.za` is live. Confirm SSL grade A on ssllabs.com and DNS has both A + AAAA records.
- [x] **Vercel Deployment Protection on previews** ✅
  ON. Right setting for a launching product — keep it.

### Security

- [ ] **Rotate any keys exposed in dev sessions** 🟡
  Resend, Groq, Upstash token, CRON_SECRET, VAPID private key — rotate as a precaution if shared with any AI assistant or pasted into chat. Don't rotate Supabase keys mid-launch (it logs everyone out).
- [x] **Supabase RLS policies audit** ✅
  Done 2026-04-27 (migration `053_rls_audit_hardening.sql`). All 29 public tables enforce RLS with `auth.uid()`-scoped policies. Three legacy SECURITY DEFINER functions had hardcoded user_ids and `anon` execute grants — `recall()` and `link_entries()` dropped (unused MCP-era helpers); `increment_usage()` locked down to `service_role` only. `user_personas` policy tightened from `public` to `authenticated`. Trigger-only functions revoked from anon/authenticated for defense-in-depth.
- [ ] **Service-role key isolation** 🟡
  `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Confirm it's only used server-side (Vercel functions) and never sent to the client or surfaced in error messages.
- [ ] **Rate limiting on key endpoints** 🟡
  Upstash Redis is configured. Confirm `/api/capture`, `/api/llm`, `/api/v1`, and auth-adjacent endpoints actually use it. AI endpoints especially — without limits, one bad actor drains your Gemini quota in minutes.

### Compliance / Legal

- [x] **Privacy Policy** ✅ (drafted in `src/views/PrivacyPolicy.tsx`)
  Covers data location (Supabase EU West, Vercel edge), retention (48h scrub on delete), third parties (Supabase, Vercel, Resend, Sentry, PostHog, Gemini), POPIA + GDPR rights. **Recommend a 30-min legal review before launch — drafted in plain English, not lawyer-vetted.**
- [x] **Terms of Service** ✅ (drafted in `src/views/TermsOfService.tsx`)
  Covers acceptable use, account termination, AI output disclaimer, governing law (South Africa), liability limits, third-party processors. **Same legal-review caveat as Privacy.**
- [ ] **Data export endpoint working** 🟡
  `/api/transfer` exists. Confirm it actually exports a user's full data on request (POPI/GDPR right of access). Test end-to-end with a fresh test account.
- [ ] **Data deletion endpoint working** 🟡
  Right of erasure. Confirm `/api/user-data?action=delete` cascades cleanly: removes entries, vault, brain, embeddings, push subs, session tokens. Test with a fresh account.
- [ ] **Cookie/analytics consent gate** 🟡
  Sentry consent banner exists. PostHog must use the same `everion_analytics_consent` localStorage gate. Don't fire PostHog before consent.
- [x] **AI-generated content disclosure** ✅
  Persistent line under the chat composer ("AI-generated. Can be wrong — check anything that matters."). ToS also has a dedicated "AI output" section.

### Telemetry / Observability

- [x] **Sentry wired** ✅ (in `main.tsx` + `ErrorBoundary.tsx`)
- [ ] **PostHog wired** 🟡 (in progress)
- [ ] **Vercel Analytics enabled** ❌
  One toggle in Vercel dashboard. Free Web Vitals on real users, no code change required.
- [x] **Production e2e watchdog** ✅ (smoke + onboarding + capture, daily + on-deploy)
- [ ] **Sentry alerts configured** 🟡
  Default project settings often have alerts off — confirm Sentry actually emails/Slacks you on new error rates.
- [x] **Lighthouse weekly synthetic audit** ✅
  `.github/workflows/lighthouse.yml` runs Sun 04:00 UTC + on-demand. Mobile + desktop, scores never fail the build (monitoring not gating). Reports uploaded as 90-day artifacts. Retries once per preset on Chrome protocol flakes.

### Weekly automated roll-up (custom — wire after API tokens are in place)

A single Monday-morning email aggregating all five tools so I see the whole picture in one inbox instead of five dashboards. Runs as a GitHub Actions cron, sends via Resend.

- [ ] **Add GitHub Actions secrets** ❌
  Repo → Settings → Secrets and variables → Actions:
  - `SENTRY_AUTH_TOKEN` (Sentry → Settings → Auth Tokens; scopes: `event:read`, `project:read`, `org:read`)
  - `SENTRY_ORG`, `SENTRY_PROJECT` (slugs from project URL)
  - `POSTHOG_API_KEY` (PostHog → Personal API Keys; scopes: `query:read`, `project:read`)
  - `POSTHOG_PROJECT_ID` (numeric, top of Project Settings)
  - `VERCEL_TOKEN` (vercel.com/account/tokens; scope: Read)
  - `VERCEL_PROJECT_ID` (`prj_xxx` from project settings)
  - `RESEND_API_KEY` (same as in Vercel — duplicate it here for the workflow to send the digest)
  - `WEEKLY_REPORT_TO` (recipient email)

  Lighthouse + e2e numbers come from this repo's own workflow runs — `GITHUB_TOKEN` is auto-injected, no extra secret needed.

- [ ] **Wire `scripts/weekly-roll-up.ts`** ❌
  Pulls last-7d metrics: Sentry error count + new issues, PostHog DAU + total captures, Vercel pageviews + bandwidth, latest Lighthouse scores (from artifact), e2e pass rate (from workflow runs). Composes one HTML email, sends via Resend.

- [ ] **Wire `.github/workflows/weekly-roll-up.yml`** ❌
  Cron `0 6 * * 1` (Mon 06:00 UTC). On-demand `workflow_dispatch` for manual runs. Calls the script, fails the workflow if the email send fails so I notice in GitHub.

- [ ] **Dry-run the first send** ❌
  First run: log the composed email body to stdout instead of sending, eyeball the numbers. Flip to live send once the format looks right.

  Subject format: `Everion weekly — 23 errors, 142 DAU, e2e ✓, perf 91/85`

### Billing (if Stripe is part of launch)

- [ ] **Stripe products configured live** ❌
  `stripe-checkout`, `stripe-webhook`, `stripe-portal` endpoints exist. Confirm they point at live keys, live products, live webhook signing secret.
- [ ] **Webhook idempotency** 🟡
  Stripe retries webhooks. Handler must dedupe on `event.id`. Without this, double-charges happen.
- [ ] **Tax handling decided** ❌
  SA VAT: 15%, threshold R1M/year. If you'll exceed, register and use Stripe Tax. If not, document the call.
- [ ] **Subscription cancellation flow tested** ❌
  End-to-end: cancel → portal → confirm → webhook → DB updates `user_usage` → user sees correct state.

---

## P1 — Should have at launch

### Quality

- [ ] **Lighthouse pass** ❌
  Run on production. Aim ≥90 Performance, ≥95 Accessibility, ≥95 Best Practices, ≥95 SEO. Fix anything red. Mobile + desktop both.
- [ ] **Real-device QA pass** ❌
  Critical at scale. Test on real iPhone Safari, real Android Chrome, Windows Chrome + Firefox, Mac Safari + Chrome. PWA install flow alone has ~6 paths across these.
- [ ] **Onboarding tested by 3 strangers** ❌
  Friends/family who haven't seen the app. Have them screen-record while you watch silently. Single highest-value thing on this list.
- [ ] **Empty-state polish** 🟡
  Every view should have a thoughtful empty state. Audit each view.
- [x] **Error messages user-friendly** ✅
  Shared `src/lib/friendlyError.ts` rewrites the common Supabase auth + network errors. Wired into auth flow, password reset, vault setup, and account settings. Pass-through preserved for unmapped messages.
- [ ] **404 / unknown route handler** 🟡
  SPA + Vercel rewrites mean unknown routes go to `/index.html`. Confirm there's a graceful in-app handler for non-existent routes.

### Communications

- [ ] **Welcome email tested across clients** ❌
  Resend is configured. Verify rendering across Gmail, Outlook, Apple Mail. Use Mailtrap or send to real accounts.
- [ ] **Email sender domain SPF/DKIM/DMARC** 🟡
  `noreply@everion.smashburgerbar.co.za` — confirm DNS records so emails don't go to spam. mail-tester.com gives a score.
- [ ] **Customer support channel** ❌
  Where do users complain? Email link in app footer is the minimum. `support@` alias forwarded to your inbox.

### PWA

- [ ] **Service worker update flow tested** ❌
  When you ship a new version, do users get the update without manual cache clear? Config uses `registerType: 'prompt'` — verify the prompt actually shows. Test by deploying twice and watching what happens to a returning user.
- [ ] **Offline mode tested** 🟡
  At least the app shell should load offline. Verify via Chrome DevTools → Application → Service Workers → Offline.

### Performance

- [ ] **Bundle size review** 🟡
  Run `npm run build`, check `dist/assets/`. Vite's `manualChunks` already splits supabase, sentry, pdfjs, mammoth, jszip. Watch the main chunk: if >500 KB gzipped, lazy-load more views.
- [ ] **Cold-start mitigation** 🟡
  First-paint matters most for new users. Test from a fresh browser, slow 3G throttle. If white screen >3s, add a server-rendered skeleton or static splash.

---

## P2 — Post-launch backlog

- [ ] **More e2e specs** — calendar persona-facts, vault unlock, search round-trip. Add as real regressions ship per skill Rule 7.
- [ ] **Status page** — Vercel + Supabase status pages suffice initially. Add a custom one (statuspage.io free tier) once ≥100 users.
- [ ] **Sentry source maps** — upload in build pipeline so stack traces are readable. Sentry Vite plugin handles this.
- [ ] **PostHog cohorts + funnels** — set up after a week of real data. Don't pre-cook.
- [ ] **Operational runbook** — write "if X breaks, do Y" for the 5 most likely failure modes. Useful at 2am.
- [ ] **Rollback procedure documented** — Vercel makes it trivial (one click). Write down where the button is.

---

## What to do this week, in order

1. **Onboarding stranger test** — 3 people, this week, before another line of code. *Cannot be delegated to Claude — needs Christian to recruit.*
2. **Vercel Pro upgrade** — flip the switch when ready ($20/mo).
3. **Add the 8 GitHub Actions secrets** for the weekly roll-up (see Telemetry section). 10 min if API portals cooperate.
4. **Optional: legal review of Privacy + ToS** — both are drafted in plain English (P0 unblocked), but a 30-min lawyer pass before launch is cheap insurance.

The rest is a 2-week backlog. Don't try to do everything before launch — you'll never launch. Pick the three things that scare you most and do those first.
