# Everion Mind — Public Launch Checklist

Project-specific, prioritized for solo dev shipping a public-scale product.

**How to use:** Work through P0 first (blocks launch). P1 is the strong-recommendation tier — get there before opening signups beyond closed beta. P2 is the post-launch backlog. Update the status icons as you go.

**Status icons:** ✅ done · 🟡 partial · ❌ missing

---

## Readiness Scorecard — 2026-04-27

Evaluation across the seven dimensions that decide whether a SaaS is "open the gate" ready. Scores are honest, not aspirational. **Overall: 6.5/10 — closed-beta ready, not full-public-launch ready.** Several P0 stability gaps below would bite within the first 1k users.

| Dimension              | Score    | Verdict                                                                                                                                                                                                                                                                                            |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**           | 7.0 / 10 | RLS hardened (053), service-role isolated, vault crypto sound (AES-256-GCM, PBKDF2-310k), every endpoint rate-limited. Drag: CSP `style-src 'unsafe-inline'`, rate-limit fail-open path when Upstash misconfigured. `.env*.local` correctly gitignored — no leak.                                  |
| **Performance**        | 6.5 / 10 | Lazy-loaded heavy chunks (pdfjs/mammoth/jszip), virtualised entries grid, inline app shell. Drag: cold-load fires several `/api/*` calls sequentially in `useDataLayer.ts`; `entryRepo.list(limit:1000)` has no cursor; `og.png` ships uncompressed at 41 KB.                                      |
| **UI / Visual**        | 7.5 / 10 | Strong design language (Espresso/Ivory/Bronze + serif/sans pairing), WCAG AA dark-theme contrast bump shipped, mobile + desktop layouts diverge cleanly. No tablet hack. Settings sidebar consolidated 12 → 5 sections (Personal / Account / Brain / Connections / Privacy & danger), Admin gated. |
| **UX**                 | 6.0 / 10 | Capture flow is tight, OmniSearch + keyboard shortcuts feel native, friendlyError mapping in place. Drag: no mandatory first-run walkthrough, modals don't trap focus, empty-states for Vault/Calendar/Chat lack action CTAs, no skip-to-content link.                                             |
| **Maintainability**    | 6.5 / 10 | TypeScript strict, 9 e2e specs, 45+ unit tests, Vitest + Playwright separated cleanly, CLAUDE.md + RUNBOOK.md present. Drag: 59 `as any` casts in src/, three god-components >1000 lines (TodoCalendarTab, VaultView, EntryList).                                                                  |
| **Stability**          | 5.5 / 10 | Single top-level ErrorBoundary, AI provider calls have no retry, idempotency only on capture + Stripe webhook. Health check returns booleans without 5xx-ing on degraded deps. **This is the weakest dimension and the most likely to surface as a public-traffic bug.**                           |
| **Compliance / Legal** | 7.0 / 10 | Privacy + ToS drafted in plain English, AI-output disclaimer surfaced, GDPR delete cascade (054) + full export endpoint working, consent banner gates Sentry + PostHog. Drag: drafts not lawyer-vetted; SPF/DKIM/DMARC for sender domain unverified.                                               |

**Where to spend the next sprint:** Stability (5.5) and UX (6.0) are the two dimensions where the score-to-effort ratio is highest. Specific items below.

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
- [x] **Service-role key isolation** ✅
      Verified 2026-04-27. `SUPABASE_SERVICE_ROLE_KEY` is referenced only under `api/_lib/` and `api/*.ts` (server-only), never imported in `src/`. Browser SDK uses anon key per `src/lib/supabase.ts`.
- [x] **Rate limiting on key endpoints** ✅
      Audited and tightened 2026-04-27 (commit `c6ec035`). Every endpoint now has a cap. Notable: `/api/notification-prefs` 30/min, `/api/push-subscribe` 20/min, gmail outer baseline 60/min + OAuth 30/min. Capture/LLM/v1/search were already covered. **Caveat:** see "Rate-limit fail-open audit" finding below.

### Compliance / Legal

- [x] **Privacy Policy** ✅ (drafted in `src/views/PrivacyPolicy.tsx`)
      Covers data location (Supabase EU West, Vercel edge), retention (48h scrub on delete), third parties (Supabase, Vercel, Resend, Sentry, PostHog, Gemini), POPIA + GDPR rights. **Recommend a 30-min legal review before launch — drafted in plain English, not lawyer-vetted.**
- [x] **Terms of Service** ✅ (drafted in `src/views/TermsOfService.tsx`)
      Covers acceptable use, account termination, AI output disclaimer, governing law (South Africa), liability limits, third-party processors. **Same legal-review caveat as Privacy.**
- [x] **Data export endpoint working** ✅
      `/api/user-data?resource=full_export` ships a 16-table dump with secrets stripped. e2e covered by `e2e/specs/settings-export.spec.ts`. `/api/transfer` is the in-product migration helper (separate concern).
- [x] **Data deletion endpoint working** ✅
      Migration `054_delete_user_cascade.sql` adds a SECURITY DEFINER `delete_user_data(p_user_id)` that DELETEs across 22 user-owned tables in dependency order. Wired into `handleDeleteAccount` in `api/user-data.ts`. e2e gated by `e2e/specs/settings-delete-account.spec.ts`.
- [x] **Cookie/analytics consent gate** ✅
      `src/components/ConsentBanner.tsx` gates both Sentry and PostHog on `everion_analytics_consent`. PostHog re-identifies after init when a user signs in pre-consent (fix in commit `fdee1af`).
- [x] **AI-generated content disclosure** ✅
      Persistent line under the chat composer ("AI-generated. Can be wrong — check anything that matters."). ToS also has a dedicated "AI output" section.

### Telemetry / Observability

- [x] **Sentry wired** ✅ (in `main.tsx` + `ErrorBoundary.tsx`)
- [x] **PostHog wired** ✅ (consent-gated, lazy-imported, re-identifies after init — see `src/lib/posthog.ts`)
- [x] **Vercel Analytics enabled** ✅ (`@vercel/analytics` + `@vercel/speed-insights` mounted in `main.tsx`, consent-gated)
- [x] **Production e2e watchdog** ✅ (smoke + onboarding + capture, daily + on-deploy)
- [ ] **Sentry alerts configured** 🟡
      Three rules to add: error-rate spike (>10/min), new issue type, and slow `/api/llm`+`/api/capture` p95. Click-by-click playbook with exact thresholds in `docs/launch-runbook-alerts-and-dns.md`. ~5 min.
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
- [x] **Webhook idempotency** ✅
      `api/_lib/stripeIdempotency.ts` uses Upstash `SET NX` with 24h TTL keyed on `event.id`; handler returns 502 on Redis failure rather than re-processing. **Caveat:** see "Stripe idempotency fail-open" finding below — without Upstash configured the dedup is bypassed.
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
      Every view should have a thoughtful empty state. Audit each view. Memory empty-state polished 2026-04-27 (`src/Everion.tsx`, added concrete-examples helper line); Vault, Calendar, Chat empty-states still need first-run-friendly CTAs.
- [x] **Error messages user-friendly** ✅
      Shared `src/lib/friendlyError.ts` rewrites the common Supabase auth + network errors. Wired into auth flow, password reset, vault setup, and account settings. Pass-through preserved for unmapped messages.
- [x] **404 / unknown route handler** ✅
      `src/views/NotFound.tsx` renders for any path not in `KNOWN_PATHS` (`/`, `/login`, `/admin`) via `src/main.tsx`. e2e covered by `e2e/specs/404.spec.ts`.

### Communications

- [ ] **Welcome email tested across clients** ❌
      Resend is configured. Verify rendering across Gmail, Outlook, Apple Mail. Use Mailtrap or send to real accounts.
- [ ] **Email sender domain SPF/DKIM/DMARC** 🟡
      `noreply@everion.smashburgerbar.co.za` — copy the records from <https://resend.com/domains> into the DNS provider for `smashburgerbar.co.za`. Step-by-step (including DMARC soak-then-tighten cadence) in `docs/launch-runbook-alerts-and-dns.md`. ~10 min.
- [ ] **Customer support channel** ❌
      Where do users complain? Email link in app footer is the minimum. `support@` alias forwarded to your inbox.

### PWA

- [x] **Service worker update flow tested** ✅
      Wired 2026-04-27 (commit `c6ec035`). `src/components/UpdatePrompt.tsx` calls `registerSW` from `virtual:pwa-register`, surfaces a "new version — refresh" toast on `needRefresh`, and posts `SKIP_WAITING` (sw.js handles it). `controllerchange` listener in `main.tsx` triggers reload. **Still owed:** smoke-test by shipping a deploy and confirming a returning user sees the toast.
- [ ] **Offline mode tested** 🟡
      At least the app shell should load offline. Verify via Chrome DevTools → Application → Service Workers → Offline.

### Performance

- [ ] **Bundle size review** 🟡
      Run `npm run build`, check `dist/assets/`. Vite's `manualChunks` already splits supabase, sentry, pdfjs, mammoth, jszip. Watch the main chunk: if >500 KB gzipped, lazy-load more views.
- [ ] **Cold-start mitigation** 🟡
      First-paint matters most for new users. Test from a fresh browser, slow 3G throttle. If white screen >3s, add a server-rendered skeleton or static splash.

---

## P2 — Post-launch backlog

- [ ] **More e2e specs** — calendar persona-facts, vault unlock, search round-trip. Add as real regressions ship per skill Rule 7. **Update 2026-04-27:** `404.spec.ts` and `search.spec.ts` (3 sub-tests covering Cmd+/, Cmd+K, mobile search button) shipped. Vault unlock + calendar still owed.
- [ ] **Status page** — Vercel + Supabase status pages suffice initially. Add a custom one (statuspage.io free tier) once ≥100 users.
- [x] **Sentry source maps** ✅ — `@sentry/vite-plugin` wired in `vite.config.js`, conditional on `SENTRY_AUTH_TOKEN` + `VITE_SENTRY_DSN`. Maps deleted post-upload so they're not publicly fetchable.
- [ ] **PostHog cohorts + funnels** — set up after a week of real data. Don't pre-cook.
- [x] **Operational runbook** ✅ — `RUNBOOK.md` covers top-5 failure modes + Vercel rollback procedure.
- [x] **Rollback procedure documented** ✅ — covered in `RUNBOOK.md`. One-click in Vercel dashboard → Deployments → ⋯ → Promote to Production.

---

## What to do this week, in order

1. **Onboarding stranger test** — 3 people, this week, before another line of code. _Cannot be delegated to Claude — needs Christian to recruit._
2. **Vercel Pro upgrade** — flip the switch when ready ($20/mo).
3. **Add the 8 GitHub Actions secrets** for the weekly roll-up (see Telemetry section). 10 min if API portals cooperate.
4. **Optional: legal review of Privacy + ToS** — both are drafted in plain English (P0 unblocked), but a 30-min lawyer pass before launch is cheap insurance.

The rest is a 2-week backlog. Don't try to do everything before launch — you'll never launch. Pick the three things that scare you most and do those first.

---

## Findings from readiness audit (2026-04-27)

New items surfaced by the cross-dimensional audit. Grouped by priority. None are paper-cuts; each one has either a security, stability, or first-impression blast radius for a public launch.

### P0 — Stability-critical (do before opening public signups)

- [ ] **AI provider calls have no retry / backoff** ❌
      `api/_lib/aiProvider.ts` returns `""` (empty string) on HTTP error with no retry, and `api/llm.ts` Groq transcription path follows the same pattern. A single transient Gemini outage cascades as a silent feature failure. Implement 3× exponential backoff (100ms → 400ms → 1.6s) and surface a 503 (with friendly UI message) on permanent failure rather than silent empty content.

- [ ] **Inner ErrorBoundaries missing on risky views** ❌
      Only one ErrorBoundary in `src/main.tsx` + one in `src/App.tsx` — both wrap the whole tree. A render error in `ChatView`, `VaultView`, or `CaptureWelcomeScreen` crashes the entire app. Wrap each in its own `<ErrorBoundary fallback={<ViewError />}>` so one bad render doesn't blow away the user's session.

- [ ] **Idempotency only on capture + Stripe webhook** 🟡
      `api/_lib/idempotency.ts` is used by `/api/capture`; `stripeIdempotency.ts` for `/api/v1` Stripe webhook. Several other write paths can double-execute on client retry: vault setup, memory save (`/api/memory-api?action=save`), API key revocation. Add `reserveIdempotency()` to each, keyed on a client-supplied request id.

- [ ] **Health check returns booleans, doesn't 5xx on degraded deps** ❌
      `handleHealth` in `api/user-data.ts` tests Supabase + Gemini and returns `{ db: true, gemini: false, ... }` with HTTP 200 even when half the stack is broken. External monitors (UptimeRobot, etc.) only see 200 → no alert. Make any failed dep return 503 with the failed-deps array, AND add an Upstash ping (currently untested).

- [ ] **PII redaction missing in `api/_lib/logger.ts`** ❌
      `createLogger().extra` field is logged verbatim. If a caller passes `{ email, token, password, apiKey }` (intentionally or by accident), it lands in stdout and Sentry. Add a redactor that masks any key matching `/(password|token|key|secret|apikey|email|jwt|cookie)/i` before output.

### P0 — Security defense-in-depth

- [ ] **CSP `style-src 'unsafe-inline'`** 🟡
      `vercel.json` line 59. Required today because the codebase uses inline `style={...}` on a lot of components. Long-term fix: nonce-based CSP (Vite supports it via `__webpack_nonce__` analog) or move to CSS-in-JS with hash-based source. Short-term: at least lock down `script-src` (already only `'self'` + posthog/vercel — good), document the inline-style allowance and the migration plan.

- [ ] **Rate-limit fail-open audit** 🟡
      `api/_lib/rateLimit.ts` line 100: only fails closed if `UPSTASH_REDIS_REST_URL` is missing. If the URL is set but the **token** is invalid, or Upstash is down, the catch on line 74 silently falls back to per-instance in-memory limiting (zero protection in serverless). Add a circuit-breaker: 3 consecutive Upstash failures → cache "unhealthy" for 5 min and return 503 instead of falling back.

- [ ] **Stripe idempotency fail-open without Upstash** 🟡
      `api/_lib/stripeIdempotency.ts` returns `{ firstTime: true }` if Upstash isn't configured, so without Redis the dedup is bypassed. Today this is fine because the webhook handler PATCHes to fixed state, but it's a trap for any future incrementing operation. Either fail closed (503 with Retry-After) or document the constraint inline.

### P1 — UX & accessibility

- [ ] **Modals don't trap focus (WCAG AA violation)** ❌
      `CaptureSheet.tsx`, `OnboardingModal.tsx`, `VaultRevealModal.tsx`, `DetailModal.tsx` — none install a focus trap. Tab key escapes into the page underneath. Install `focus-trap-react` (≈4 KB) and wrap each `role="dialog"` body. Restore focus to the triggering element on close.

- [ ] **No skip-to-main-content link** ❌
      Keyboard users have to Tab through the entire sidebar (5 nav buttons + settings + theme) before reaching the entries grid. Add `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>` at the top of the layout, and `id="main-content"` on the entries wrapper.

- [ ] **Empty-state CTAs missing on Vault, Calendar, Chat** 🟡
      Memory empty-state polished 2026-04-27. Vault and Calendar render blank or near-blank when empty. Chat shows a no-memory toast but no actionable step. Each should surface a "next action" tied to the view ("Add your first secret", "Add a todo or sync your calendar", "Capture something to chat about").

- [ ] **Settings sidebar density** 🟡
      14 \*Tab.tsx files (Account, Profile, Brain, Data, Appearance, AI, Providers, Security, Calendar Sync, Gmail Sync, Claude Code, Billing, Danger, Admin). For a non-technical first-time user this is decision fatigue. Either collapse to 5–6 logical groups with sub-sections, or hide the technical tabs (Providers, Claude Code, Admin) behind a "Developer" toggle.

- [ ] **No mandatory first-run walkthrough** ❌
      `src/components/OnboardingModal.tsx` exists but is skippable on the first interaction. New users land on an empty Memory tab with no forcing function. Add a 3-step forced flow (your name → capture a sample → see it appear) that can't be dismissed without acknowledging.

### P1 — Performance

- [ ] **Sequential `/api/*` calls on cold load** 🟡
      `src/hooks/useDataLayer.ts` fires vault status, vault entries, and search-graph prefetch as separate awaits. On 3G this stacks ~300–500 ms of needless latency. Batch them with `Promise.allSettled([...])` so the page hydrates in one round-trip instead of three.

- [ ] **`entryRepo.list({ limit: 1000 })` without pagination cursor** 🟡
      For users with >5k entries the initial fetch blocks the network tab for 2–3 s. Implement cursor pagination: 200 on first call, then 500 ms-staggered follow-ups so the UI is interactive before the long tail arrives.

- [ ] **`public/og.png` is 41 KB uncompressed** 🟡
      Compress to WebP (target <15 KB) and ship both `og.png` and `og.webp`, or accept the 41 KB if shares are infrequent. Cosmetic but cheap.

- [ ] **No `loading="lazy"` on user-uploaded image content** 🟡
      Audit `EntryCard` / `EntryRow` (or whichever renders `<img>` for user media). Add `loading="lazy"` + `decoding="async"` on any non-critical image so off-screen cards don't decode synchronously on first paint.

### P1 — Maintainability

- [ ] **59 `as any` casts in `src/`** 🟡
      Concentrated in `src/lib/enrichEntry.ts` (10), `src/views/DetailModal.tsx` (9), `src/hooks/useEntryActions.ts` (6), `src/components/EntryList.tsx` (6). Most are runtime-added fields (`pinned`, `importance`, etc.) that should live on the `Entry` type. Widen `Entry` in `src/types.ts` or extract a `RichEntry = Entry & { ... }` and migrate. `tsconfig.json` already has `strict: true` — `noUncheckedIndexedAccess` and `noImplicitAny` would catch new ones.

- [ ] **Three god-components >1000 lines** 🟡
      `src/views/TodoCalendarTab.tsx` (1309), `src/views/VaultView.tsx` (1217), `src/components/EntryList.tsx` (986). Each handles fetching, filtering, display, and mutations in one file. Extract presentational sub-components (e.g., `EntryListFilters`, `VaultEntryCard`, `CalendarMonthGrid`) and move side effects into hooks. Don't refactor for its own sake — do it next time you touch one of these for a feature.

- [ ] **e2e for vault unlock + delete cascade** ❌
      Vault is the most security-sensitive surface in the app (master-password-derived AES-GCM, opt-in encrypted secrets). Zero e2e coverage today. Add `e2e/specs/vault.spec.ts`: set master password → save secret → re-lock → unlock with wrong password (rejected) → unlock with right password → reveal → delete.

### P1 — Compliance follow-ups

- [ ] **Sender domain SPF / DKIM / DMARC** ❌
      `noreply@everion.smashburgerbar.co.za` sends auth links + (eventually) weekly digests. Confirm DNS records are configured so email lands in inbox, not spam. mail-tester.com gives a 10/10 score with all three.

- [ ] **30-min legal review of Privacy + ToS drafts** 🟡
      Drafts exist in `src/views/PrivacyPolicy.tsx` + `src/views/TermsOfService.tsx`. Plain English, not lawyer-vetted. Cheap insurance: pay a SA attorney to glance at both before launch.

### P2 — Post-launch hardening

- [ ] **Remove `as any` ratchet** — once the count is at 0, add an ESLint rule that fails CI on `any`. (`@typescript-eslint/no-explicit-any` set to error.)
- [x] **Settings consolidation** ✅ — collapsed 12 sections to 5 (Personal / Account / Brain / Connections / Privacy & danger) + Admin gated. URL aliases preserve OAuth callbacks and `?tab=billing` deep links from /api/capture and /api/llm.
- [ ] **CSP nonce migration** — drop `'unsafe-inline'` from `style-src`. Plan a one-week migration once inline-style hotspots are mapped.
- [ ] **Per-user audit log** — for "who deleted what / when" support questions. Lightweight table, append-only, surfaced in `/settings/security`.
