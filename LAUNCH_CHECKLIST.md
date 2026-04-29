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
- [ ] **Supabase Pro upgrade** ❌ (CRITICAL — confirmed on Free tier 2026-04-28)
      Free tier ships with **zero automated backups** and a 500 MB database cap. At ~3 KB per entry (768-dim embedding + content) you fit ~150k entries before hitting the cap, then writes start rejecting. For a public-scale product this is a launch blocker.
      Pro ($25/mo) gets:
      - Daily automated backups, 7-day retention
      - 8 GB DB (16× headroom)
      - 250 GB bandwidth/month (125× headroom)
      - Branching for safer DDL changes
      - Restore via dashboard one-click
      Optional PITR add-on (~$100/mo) for restore-to-any-second; daily is fine for a memory app where users can re-import.
      Upgrade at <https://supabase.com/dashboard/project/wfvoqpdfzkqnenzjxhui/settings/billing>.

      **DIY pg_dump backup workflow shipped 2026-04-28** — `.github/workflows/db-backup.yml` runs daily at 03:17 UTC, dumps the `public` schema, gzips, uploads as a private GitHub Release tagged `backup-YYYY-MM-DD`, and prunes anything older than 30 days. Restore procedure is in `RUNBOOK.md`. **One setup step left:**

      - [ ] Add `SUPABASE_DB_URL` to repo secrets (Settings → Secrets and variables → Actions). Format:
            `postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
            (Session pooler mode, port 5432 — NOT the transaction pooler on 6543, which doesn't support pg_dump.) Get the URI from Supabase dashboard → Project Settings → Database → Connection string → URI.
      - [ ] Trigger the workflow once via `workflow_dispatch` to confirm the first dump lands. Then it runs daily.

      **DIY backups are a stop-gap.** They cover "I dropped the wrong table" but not "the project got nuked" (the `auth` schema isn't dumped, so users can't be restored). Pro is still the right answer before public launch.
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

### Design system / UI consistency (shadcn migration)

App audit on 2026-04-29 found ~298 hand-rolled UI instances across 49+ files with significant visual drift (5+ button padding variants, 4–18px border radii, hardcoded shadows, no z-index system). `components.json` is configured but `src/components/ui/` is empty. Migration to shadcn primitives (themed with existing design tokens) gives consistency, accessibility-by-default (Radix kbd nav + focus traps), and one-place restyle.

**Phase 1 — Safe wins (low risk, high impact)** ❌

- [ ] **Button** — replace 80+ hand-rolled `<button>` instances. Top files: `OnboardingModal.tsx`, `settings/ProfileTab.tsx`, `DetailModal.tsx`, `NotificationBell.tsx`, `BulkActionBar.tsx`. Standardise variants: primary (ember), secondary (ghost), destructive (danger), outline.
- [ ] **Input + Textarea** — 25+ instances. Top files: `OnboardingModal.tsx`, `DetailModal.tsx`, `CaptureSheet.tsx`, `ChatComposer.tsx`. Two patterns to consolidate: serif (entry editing) and sans (settings/forms).
- [ ] **Card** — 25+ container patterns. Top files: `NotificationBell.tsx`, `EntryListBits.tsx`, settings sections.
- [ ] **Separator** — 40+ inline `<div height:1px>` divider instances.
- [ ] **Badge** — 30+ tag/type/status pill instances. Top files: `EntryListBits.tsx`, `CaptureSheet.tsx`, `DetailModal.tsx`.
- [ ] **Tabs** — 12+ segmented controls. Top files: `MemoryHeader.tsx`, `SettingsView.tsx`, `TodoView.tsx`, `CaptureSheet.tsx`. Adds keyboard arrow navigation for free.
- [ ] **Switch** — 15+ toggle controls (theme, notification prefs, Someday gate, etc).
- [ ] **Checkbox** — 8 instances (currently native, no focus ring). `BulkActionBar.tsx`, `EntryList.tsx`, new `SomedayBulkBar`.

**Phase 2 — Stateful primitives (medium risk)** ❌

- [ ] **DropdownMenu / Select / Popover** — 45+ custom dropdowns. Replaces manual escape/click-outside in `BrainSwitcher.tsx`, `OmniSearch.tsx`, recategorise picker, sort picker, model/tier/bucket pickers. Adds proper keyboard nav (arrows / Home / End / typeahead).
- [ ] **Sonner (toast library)** — kills 6 toast files: `UpdatePrompt.tsx`, `BackgroundTaskToast.tsx`, `BackgroundOpsToast.tsx`, `UndoToast.tsx`, `NudgeBanner.tsx`, `ConsentBanner.tsx`. Single queue + stacking + dismiss for free.
- [ ] **Tooltip** — currently <5 native `title` attrs. Add tooltips to icon buttons across header, bulk bar, settings.
- [ ] **Accordion** — 8 `[expanded, setExpanded]` patterns in settings tabs + bulk bar. Adds smooth height animation + ARIA.
- [ ] **Calendar + Popover** — replace 3 native `<input type="date">` instances in `TodoCalendarTab` + `ScheduleInline`.

**Phase 3 — High-touch (high risk, requires care)** ❌

- [ ] **Dialog** — migrate 7 `FocusTrap`-wrapped modals: `CaptureSheet.tsx`, `OnboardingModal.tsx`, `MoveToBrainModal.tsx`, `CreateBrainModal.tsx`, `VaultRevealModal.tsx`, `DetailModal.tsx`, `settings/ProfileTab.tsx`. shadcn `Dialog` handles focus trap natively → removes `focus-trap-react` dep + ~200 lines of manual escape/scroll-lock plumbing.
- [ ] **Sheet (vaul)** — replace `CaptureSheet.tsx` drag-to-close. shadcn's `Drawer` uses `vaul` which has rubber-band easing, threshold-based dismiss, and body scroll lock built in. Port the existing 80px threshold + 200px rubber-band tuning.
- [ ] **Command (cmdk)** — replace `OmniSearch.tsx` custom popover with proper command palette (typeahead, fuzzy match, kbd shortcuts).
- [ ] **window.confirm() removals** — `BulkActionBar.tsx` line ~269 + `settings/ProfileTab.tsx` (still violates CLAUDE.md no-OS-UI rule). Replace with `Dialog` + Button pair.

**Cross-cutting cleanup (do as part of migration)**

- [ ] **Standardise z-index** — current zoo (50/55/60/110/200/250) → tokens: `z-modal`, `z-toast`, `z-dropdown`, `z-tooltip`. Tailwind utility per layer.
- [ ] **Standardise radius** — current spread 4–18px → tokens: `rounded-sm/md/lg/xl/full`. Audit and pick one per role (chip, card, modal).
- [ ] **Standardise shadows** — replace hardcoded `rgba(0,0,0,0.x)` with `--lift-1/2/3` tokens (already exist).

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

### Shared brains — phase 2+ (deferred from 2026-04-28 brainstorm)

Phase 1 (solo multi-brain plumbing) shipped behind flag `multiBrain`. Spec: `docs/superpowers/specs/2026-04-28-shared-brains-design.md`. Decisions already locked, implementation deferred:

- [ ] **Phase 2: invites + members** — `brain_members`, `brain_invites` tables. POST `/api/user-data?resource=brains&action=invite` (email + link). Email-redemption flow via Resend (signup link → auto-join on first login). Member-list view in Settings → Brains tab. Owner can revoke invites.
- [ ] **Phase 2: roles** — owner / member / observer. Member = wiki-style edit any (locked: brainstorm Q3 = B). Observer = read-only.
- [ ] **Phase 2: RLS for shared access** — replace `brains_owner_all` with policies that grant SELECT to members/observers, INSERT/UPDATE/DELETE on entries to members + owner only. Service-role bypass for system jobs unchanged.
- [ ] **Phase 2: audit-log events** — `brain_invited`, `brain_joined`, `brain_member_removed`, `brain_role_changed` on the existing `audit_log` table (migration 053).
- [ ] **Phase 3: full management UX** — transfer ownership, delete brain with member confirmation broadcast, "leave brain" for members.
- [ ] **Phase 3: brain-level activity feed** — see who added/edited what, when (read from audit_log).
- [ ] **Phase 4: discovery / public brains** — out of scope for 2026; only revisit if community use case re-emerges.

### Other backlog

- [ ] **More e2e specs** — calendar persona-facts, vault unlock, search round-trip. Add as real regressions ship per skill Rule 7. **Update 2026-04-27:** `404.spec.ts` and `search.spec.ts` (3 sub-tests covering Cmd+/, Cmd+K, mobile search button) shipped. Vault unlock + calendar still owed.
- [x] **Public status page** ✅ — `/status` lives at `https://everion.smashburgerbar.co.za/status`. Polls `/api/status` every 30s, shows API/DB/AI provider up/down. Public, no auth, edge-cached 15s + SWR 60s. Renders ahead of the auth gate so it works even when Supabase auth itself is down. Built 2026-04-28.
- [x] **Sentry source maps** ✅ — `@sentry/vite-plugin` wired in `vite.config.js`, conditional on `SENTRY_AUTH_TOKEN` + `VITE_SENTRY_DSN`. Maps deleted post-upload so they're not publicly fetchable.
- [ ] **PostHog cohorts + funnels** — set up after a week of real data. Don't pre-cook.
- [x] **Operational runbook** ✅ — `RUNBOOK.md` covers top-5 failure modes + Vercel rollback procedure.
- [x] **Rollback procedure documented** ✅ — covered in `RUNBOOK.md`. One-click in Vercel dashboard → Deployments → ⋯ → Promote to Production.

---

## Owner-only tasks (Christian's flat to-do list)

Distilled from the rest of the file. **Only items that require Christian — clicking dashboard buttons, paying for things, talking to humans, making business decisions.** Code work is tracked in the sections above. Updated 2026-04-28.

### 🚨 Before public launch (P0 — ordered by impact)

- [ ] **Upgrade Supabase to Pro** ($25/mo). No backups exist on Free tier. <https://supabase.com/dashboard/project/wfvoqpdfzkqnenzjxhui/settings/billing>
- [ ] **Upgrade Vercel to Hobby → Pro** ($20/mo). Hobby times out functions at 60s; `vercel.json` already requests 300s.
- [ ] **Add `SUPABASE_DB_URL` secret to GitHub repo**. Settings → Secrets and variables → Actions → New secret. Get the URI from Supabase → Project Settings → Database → Connection string → URI (Session pooler, port **5432** not 6543). This activates the daily DIY backup workflow until Pro is on.
- [ ] **Trigger first DB backup**: `gh workflow run db-backup.yml` then `gh release list` to confirm `backup-2026-04-28` lands.
- [ ] **Rotate keys** exposed in any AI/chat session: Resend, Groq, Upstash REST token, CRON_SECRET, VAPID private key. Don't rotate Supabase keys mid-launch (logs everyone out).
- [ ] **Configure Sentry alerts** — 3 rules from `docs/launch-runbook-alerts-and-dns.md`: error-rate spike (>10/min), new issue type, slow `/api/llm`+`/api/capture` p95. ~5 min.
- [ ] **Confirm SSL grade A** on <https://www.ssllabs.com/ssltest/analyze.html?d=everion.smashburgerbar.co.za>.
- [ ] **Confirm DNS A + AAAA records** for `everion.smashburgerbar.co.za`. Dig from a public resolver: `nslookup everion.smashburgerbar.co.za 1.1.1.1`.
- [ ] **Configure Resend SPF / DKIM / DMARC** for `noreply@everion.smashburgerbar.co.za`. Records in <https://resend.com/domains>; paste into your DNS provider for `smashburgerbar.co.za`. Verify at <https://www.mail-tester.com> — aim for 10/10.
- [ ] **Customer support channel**: forward `support@everion.smashburgerbar.co.za` to your inbox. Add the link in app footer.

### 💳 Stripe (only if billing is part of launch)

- [ ] **Configure live Stripe products**: copy product IDs from live mode into `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, etc. in Vercel env vars.
- [ ] **Wire Stripe live webhook signing secret** into `STRIPE_WEBHOOK_SECRET` (Vercel env). Different from test mode secret.
- [ ] **SA VAT decision**: register for VAT if you'll cross R1M/year, use Stripe Tax. If not, document the call.
- [ ] **End-to-end subscription cancellation test**: subscribe → portal → cancel → confirm webhook → DB updates → user sees correct state.

### 📊 Weekly roll-up email setup

Eight GitHub Actions secrets to add (Settings → Secrets and variables → Actions). Detailed in the Telemetry section above. ~10 min if API portals cooperate.

- [ ] `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- [ ] `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`
- [ ] `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`
- [ ] `RESEND_API_KEY` (duplicate from Vercel env)
- [ ] `WEEKLY_REPORT_TO` (your email)
- [ ] **Dry-run** the first send with stdout-only mode, eyeball numbers, then flip to live.

### 👥 People stuff (P0 + P1 — cannot be delegated)

- [ ] **Onboarding test with 3 strangers** — friends/family who haven't seen the app. Have them screen-record while you watch silently, no coaching. Single highest-value pre-launch task. Today/this week.
- [ ] **Real-device QA pass**: real iPhone Safari, real Android Chrome, Windows Chrome + Firefox, Mac Safari + Chrome. PWA install flow on each. ~1 hr.
- [ ] **Co-admin on every dashboard** (bus factor): Vercel team, Supabase organization, Stripe, Sentry, PostHog, Resend, Upstash, GitHub repo. ~10 min/provider × 8 = 80 min total.
- [ ] **Optional but cheap insurance**: 30-min legal review of `src/views/PrivacyPolicy.tsx` + `src/views/TermsOfService.tsx` drafts before launch. Plain English drafts exist; lawyer-vet for ZAR-jurisdiction.

### 🔗 Visibility (small but high-leverage)

- [x] **Pin `/status` link** in landing-page footer + login screen "having trouble?" link ✅ (support email signature still owed when sender domain is configured)
      `src/views/Landing.tsx` Support footer column gains "Service status" → `/status`. `src/LoginScreen.tsx` privacy/terms row gains "Having trouble?" → `/status`. Shipped 2026-04-29.

### 🗓️ One-time then quarterly

- [ ] **Test the Supabase backup restore once** — see "Test Supabase backup restore" item above for the 15-min procedure. Repeat every 90 days.

### 🔋 Performance (do once before launch)

- [ ] **Run Lighthouse on production**: target ≥90 Performance, ≥95 Accessibility, ≥95 Best Practices, ≥95 SEO. Fix anything red. Mobile + desktop both. (Weekly synthetic audit already running, but eyeball the numbers once before opening signups.)
- [ ] **Bundle-size eyeball**: `npm run build`, look at `dist/assets/`. If main chunk >500 KB gzipped, lazy-load more views.

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

- [x] **AI provider calls have no retry / backoff** ✅
      Embedding paths shipped 2026-04-28. `api/_lib/aiProvider.ts` already had `fetchWithRetry` (100ms → 400ms → 1.6s, 5xx + 429 + network) for all three adapters (Anthropic / OpenAI / Gemini). `api/llm.ts` Groq transcription wired with the same pattern 2026-04-29 (400ms → 1.2s → 3s).

- [x] **Inner ErrorBoundaries on risky views** ✅
      `src/Everion.tsx` wraps `ChatView`, `VaultView`, `CaptureWelcomeScreen`, `GraphView`, `TodoView` each in their own `<ErrorBoundary name="..." fallback={ViewError}>`. A render error in one view shows a localized fallback instead of blowing away the shell.

- [ ] **Idempotency only on capture + Stripe webhook** 🟡
      `api/_lib/idempotency.ts` is used by `/api/capture`; `stripeIdempotency.ts` for `/api/v1` Stripe webhook. Several other write paths could double-execute on client retry: vault setup, API key revocation. Memory-save (`/api/memory-api?action=save`) is **not** a real endpoint (memory-api is read-only — `retrieve` + `upcoming` only). Add `reserveIdempotency()` to vault-setup + key-revocation when those become real concerns.

- [x] **Health check 5xx on degraded deps** ✅
      `handleHealth` in `api/user-data.ts:493` tests db + Gemini + Groq + Upstash, builds a `failures[]` array, returns **503** when any required dep is down (200 only when fully green). External monitors now see real outages.

- [x] **PII redaction in `api/_lib/logger.ts`** ✅
      `redact()` runs both base context and per-call extras through a regex matcher (`/(password|passwd|secret|token|apikey|api_key|key|jwt|cookie|session|email|authorization|bearer)/i`) with a 4-deep recursion cap. Substring match → no typo can slip through.

### P0 — Security defense-in-depth

- [ ] **CSP `style-src 'unsafe-inline'`** 🟡
      `vercel.json` line 59. Required today because the codebase uses inline `style={...}` on a lot of components. Long-term fix: nonce-based CSP (Vite supports it via `__webpack_nonce__` analog) or move to CSS-in-JS with hash-based source. Short-term: at least lock down `script-src` (already only `'self'` + posthog/vercel — good), document the inline-style allowance and the migration plan.

- [ ] **Rate-limit fail-open audit** 🟡
      `api/_lib/rateLimit.ts` line 100: only fails closed if `UPSTASH_REDIS_REST_URL` is missing. If the URL is set but the **token** is invalid, or Upstash is down, the catch on line 74 silently falls back to per-instance in-memory limiting (zero protection in serverless). Add a circuit-breaker: 3 consecutive Upstash failures → cache "unhealthy" for 5 min and return 503 instead of falling back.

- [ ] **Stripe idempotency fail-open without Upstash** 🟡
      `api/_lib/stripeIdempotency.ts` returns `{ firstTime: true }` if Upstash isn't configured, so without Redis the dedup is bypassed. Today this is fine because the webhook handler PATCHes to fixed state, but it's a trap for any future incrementing operation. Either fail closed (503 with Retry-After) or document the constraint inline.

### P1 — UX & accessibility

- [x] **Modals trap focus** ✅
      `focus-trap-react` is installed and wraps `CaptureSheet`, `OnboardingModal`, `VaultRevealModal`, `DetailModal`, `CreateBrainModal`, `MoveToBrainModal`. Tab key stays inside the dialog; outside-click and Escape paths owned by each modal.

- [x] **Skip-to-main-content link** ✅
      `src/Everion.tsx:267` ships `<a href="#main-content" className="sr-only focus:not-sr-only">` with the counterpart `id="main-content"` on the view wrapper at line 388.

- [x] **Empty-state CTAs on Vault + Chat** ✅ (Calendar N/A — month grid IS the visualization)
      `VaultView` empty state has icon + heading + helper + "Add a secret" CTA. `ChatView` no-memory state has heading + helper + "Capture a thought" CTA wired to `onNavigate("capture")`. Calendar's grid renders even with zero events; no separate empty-state surface to add a CTA to.

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

- [x] **No `loading="lazy"` on user-uploaded image content** ✅ (N/A)
      Audited `src/`: there are no `<img>` or `<Image>` tags rendering user content. Image extraction goes through Gemini multimodal at capture time and returns extracted text — the binary is never displayed back. Nothing to lazy-load.

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
- [x] **Per-user audit log table** ✅ — `audit_log` exists in production with 369 rows since 2026-04-25, written by `api/capture.ts`, `api/entries.ts`, `api/llm.ts`. RLS lets users read their own rows. Migration `057_audit_log.sql` ratifies the schema (idempotent — table was added inline in `000_init.sql`).
- [ ] **Audit-log UI surface** — show users their own activity in `/settings/security`. Backend ready (RLS done); just wire a paginated table reader.

### Operations & bus factor (added 2026-04-28)

- [x] **Staging Supabase project** ✅ — `everion-staging` (`rsnrvebcjbstfxhkfsjq`, eu-west-1, free tier, $0/mo). Schema mirrors production via `supabase/migrations/*.sql`. URL + anon key in `.env.example`. Workflow: apply new migrations to staging FIRST, verify, THEN apply to production. Drift check reminder saved to Christian's Everion memory for 2026-05-28.
- [x] **Pin `/status` link somewhere user-visible** ✅ — landing footer + login "Having trouble?" wired 2026-04-29. Support email signature still owed once sender domain is configured.
- [ ] **Co-admin on every dashboard** ❌ — bus factor. Add a second admin (wife / co-founder / trusted contractor) to: Vercel team, Supabase organization, Stripe, Sentry, PostHog, Resend, Upstash, GitHub repo. ~10 min per provider; total ~90 min.
- [ ] **Test Supabase backup restore** ❌ — depends on the Pro-upgrade above. **Currently on Free tier (no automated backups exist).** Once Pro is on, backups run daily automatically with 7-day retention; this item becomes a one-time dry-run + a quarterly habit. A backup you've never restored is a hope, not a backup.

  **Step 0: confirm Pro is active** (1 min, after you've upgraded)
  - Open <https://supabase.com/dashboard/project/wfvoqpdfzkqnenzjxhui/database/backups>
  - You should see 7 daily entries. If empty, you're still on Free — see "Supabase Pro upgrade" item above.

  **Step 1: dry-run a restore to a fresh project** (15 min, do this once before launch)
  - Backups page → pick any daily backup → "Restore"
  - **Choose "Restore to new project"** (NOT in-place; in-place is destructive)
  - Wait ~5 min for the new project to provision
  - Open SQL editor on the restored project: `SELECT COUNT(*) FROM entries;`
  - Row count should match production at the backup snapshot time. If it does, restores work.
  - Delete the test project so it doesn't sit on your bill.

  **Step 2: re-run quarterly**
  - 15 min every 90 days. The only way to know backups are real and not just claimed.

  **Optional: PITR add-on (~$100/mo)** — restore to any second, not just daily snapshots. Toggle in dashboard → Settings → Add-ons. Worth it if your data is irreplaceable; for a memory app where users can re-import, daily is probably enough.

  **What backups DON'T cover**
  - Auth users are backed up on the same schedule (different schema, same dashboard restore).
  - Storage objects need separate config — N/A here, you don't use Supabase Storage.
  - Vault crypto material — vault uses passphrase-derived keys the server can't read. Backups capture the encrypted blobs but a user who forgets their master password can't recover, backup or no backup. By design.
