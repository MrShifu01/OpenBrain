# 30-Day Launch Schedule — 2026-05-01 → 2026-06-01

**Solo dev. PWA + Android live on day 30 = closed beta opens. 30-day beta phase. Public launch (PH + HN + Reddit blast) on ~2026-07-01 (day 60). iOS submitted during beta phase (~week 5-6).**

This is the operational schedule. ROADMAP.md is the strategic horizon (3-week sprint → 12-month plan). LAUNCH_CHECKLIST.md is the live task list. **This file translates both into dated daily blocks** so every morning you open it and see exactly what today is for.

> **Locked decisions (2026-05-01):** iOS shipped post-Android (week 5+, during beta). Trademark check on **"Everion Mind"** (full product name). Google Play Dev, Vercel Pro, Supabase Pro need enrollment day 1. Daily ceiling 7-9 h. **Day 30 = closed beta launch** (50-100 invites, Twitter announce, NO PH). 30-day beta phase. **Day 60 (~2026-07-01) = public launch with PH + HN + Reddit blast.** Domain transfer to `everionmind.com` in week 2. Global launch. Polish current Landing.tsx, no separate marketing site.

---

## Critical assumptions (BAKED IN — push back to revise)

| # | Assumption | If wrong |
| - | ---------- | -------- |
| 1 | **iOS = SHIPS POST-LAUNCH (week 5-6).** Android + PWA only in the 30-day window. iOS submission targeted for ~2026-06-15. Capacitor wrap is already installed for both, so it's TestFlight + Apple Dev enrollment + Privacy Manifest + iOS screenshots later, NOT a rebuild. | If you insist iOS-day-30: -1 week of polish + Apple review variance (1-3 days median, up to 7) destroys the calendar buffer. |
| 2 | **Trademark on "Everion Mind"** (full product name, USPTO TESS + WIPO Madrid Monitor + ZA-CIPC class-9 software). NOT YET CHECKED — day-1 morning, hard-block escalation. | Brand change = schedule reset. **The single most schedule-fragile item.** |
| 3 | **Google Play Developer account NOT YET ENROLLED.** Day-1 morning task ($25, ~10-min form, instant approval most cases — 24h worst case). | If Google delays approval beyond day 4, AAB upload deadline (day 21) pushes back. Plan B: launch PWA-only on day 30, Android slips 3-7 days. |
| 4 | **Vercel Pro + Supabase Pro NOT YET PAID.** Day-1 task. Both required: Vercel for `maxDuration: 300` on llm.ts/gmail.ts/user-data.ts, Supabase for backups + 8 GB DB. | Hobby/Free at public-launch traffic = function timeouts + DB cap-out + zero recovery from "I dropped a table." Non-negotiable. |
| 5 | **`everionmind.com` NOT YET BOUGHT — buy + DNS-swap in week 2 (per 2026-05-01 decision).** Domain purchase is 5 min any time; the migration (Vercel domain swap, Supabase auth allowed-redirects, LemonSqueezy webhook URL, RevenueCat webhook URL) is the actual work and needs a quiet day. Schedule slot: day 8 (Fri 05-08). Until then, all dashboards stay on `everion.smashburgerbar.co.za`. | If purchase slips into week 3, Play Console listing + assetlinks.json need to point at the swapped domain — last-minute migration risk. Buy NLT day 8 morning. |
| 6 | **7-9 h/day weekdays, 4-6 h weekends.** ~50 h/week. ~200 h budget for the 30 days. | Halve the velocity = drop Brain Feed v0, drop streak counter, drop Cmd+K, ship ugly-but-honest. |
| 7 | **Day 30 = closed beta launch (LOCKED 2026-05-01).** 50-100 invites + Twitter announce. NO Product Hunt, HN, or Reddit blast. 30-day beta phase. **Day ~60 (~2026-07-01) = public launch with PH + HN + Reddit.** Beta phase produces retention data + word-of-mouth + PH waitlist + iOS submission. | If beta retention < 25% by day 45, push public launch to day 75 and fix retention first. |
| 8 | **`everionmind.com` polished Landing + custom domain.** No separate marketing-site repo. | +3-4 days for an Astro/Next marketing site you don't need. |
| 9 | **Global launch.** LemonSqueezy = merchant of record handles VAT/tax. Apple/Google geo-restriction not toggled. | SA-only is faster operationally but smaller TAM. |
| 10 | **Brain Feed v0 ships day 11 (week 2)** — fast version: surface gap-analyst output + 1 resurfaced memory + capture bar. NOT the full ROADMAP Brain Feed (3-5 days). v0 = 1.5 days. | Drop entirely = empty home screen at public launch. v0 is the cheapest defensible version. |
| 11 | **Onboarding "aha in 60s" stays in scope.** ROADMAP Week 2 days 11-13. Highest-leverage retention lever pre-launch. | Drop = Day 7 retention 10-15%. Don't drop. |
| 12 | **PostHog funnel stays in scope.** 8 events from ROADMAP. Without it you fly blind. | Drop = no data, no iteration, no retention math. Don't drop. |

---

## North star — read this every morning

> **EverionMind exists to give one person a brain that gets smarter every day.**
>
> Today I am doing the single thing that moves the most important metric this week.
>
> Hide features. Nail onboarding. Ship the moment.

Pinned from ROADMAP.md. Print it.

---

## The five hard deadlines

| Date | Deadline | If missed |
| ---- | -------- | --------- |
| 2026-05-02 (Sat Wk1) | Trademark check on "Everion Mind" — Google Play Dev enrollment — Vercel Pro — Supabase Pro all green | **Schedule slips 1:1.** No code work matters until the dashboards are paid + provisioned. Trademark conflict = brand-change escalation, separate decision tree. |
| 2026-05-08 (Fri Wk2) | `everionmind.com` purchased + DNS swap done + Supabase/LS/RC webhook URLs updated | Listing copy + assetlinks.json must reference the live domain by week 3 day 18. Last-minute domain swap mid-launch = high regression risk. |
| 2026-05-14 (Wed Wk2) | Operator setup complete (LS variants, RC dashboard, Play Console subscription products) | Native build can't reach an entitlement. Plan B: launch Android as free-only, paid web-only — but it splits the billing surface and forces tier-comparison-table caveats. |
| 2026-05-21 (Thu Wk3) | Play Console internal-testing track LIVE with signed AAB | **Pulled forward 1 day from original schedule** — Play production review takes 1-7 days, so AAB upload day 21 → review submit day 22 → ideally approved by day 28. Plan B: launch PWA-only on day 30, Android slips 3-7 days. |
| 2026-05-28 (Thu Wk4) | Play Console production review submitted **AND APPROVED** for day-30 public launch | If submitted-but-not-approved on day 30: launch PWA + Android-coming-soon banner. Don't post PH/HN/Reddit until Android approves (the listing review happens in public). |

**Beta + public-launch arc (LOCKED 2026-05-01):**

| Phase | Window | What's live | Marketing posture |
| ----- | ------ | ----------- | ----------------- |
| Build | Day 1–29 | Internal only | Twitter daily build-in-public |
| **Closed beta** | **Day 30 (Sat 2026-05-30)** | PWA + Android, 50-100 invites | Twitter announce, your network, beta-only landing |
| Beta phase | Day 30–60 | Iterating on retention | Cultivate PH hunter relationship, build PH "upcoming" waitlist, daily build-in-public |
| **Public launch** | **Day ~60 (Mon 2026-07-01)** | Full public + iOS | **Product Hunt + HN + Reddit blast same day** |

**During beta phase (days 30-60):**
- Brain Feed v1 (full ROADMAP version) ships ~day 38
- iOS submission to App Store ~day 42 (Apple Dev enrollment day 31)
- 1 Twitter thread / week with beta learnings
- PH "upcoming" page live by day 35
- Hunter outreach (3-5 candidates) by day 45
- Retention data review every Monday — kill or double down on features per Day 7 numbers

---

## Weekly arc

```
Week 1 (Fri 05-01 → Thu 05-07)  DECIDE & PROVISION
  Trademark + dashboards + dev accounts + ruthless pruning of nav

Week 2 (Fri 05-08 → Thu 05-14)  DOMAIN + ONBOARDING + INSTRUMENT + FEED v0
  Buy everionmind.com + DNS swap + auth-redirect migration day 1
  Aha-in-60s flow, PostHog funnel, streak counter, Cmd+K capture
  Brain Feed v0 (gap-analyst + 1 resurfaced + capture bar)

Week 3 (Fri 05-15 → Thu 05-21)  NATIVE + ASSETS + LIGHTHOUSE
  Real-device QA, screenshots @ 1080×1920, demo video, Play Data
  Safety form, AAB signed + uploaded by day 21 (Thu), Lighthouse
  green, demo account for Play review.

Week 4 (Fri 05-22 → Thu 05-28)  SUBMIT + LANDING POLISH + BETA INVITE PREP
  Play production review submitted day 22, daily review-status
  check, Landing copy lock, FAQ refresh, status/changelog pages,
  beta invite list compiled (50-100 names), beta invite email
  drafted, welcome email tested across clients.

Buffer (Fri 05-29 → Sat 05-30)  REVIEW WAIT + CLOSED BETA OPENS
  Watch Play review. Day 30 (Sat 2026-05-30) = beta opens to
  invite list. Twitter announce. NO PH/HN/Reddit.

----- BETA PHASE (Day 30 → Day 60) -----

Days 30-37  BETA WEEK 1 — TRIAGE
  Watch Sentry like a hawk. Reply to every signup within 1h.
  Hand-hold first 50 users. Ship critical fixes inside 6 hours.

Days 38-44  BETA WEEK 2 — BRAIN FEED v1 + iOS PREP
  Ship full ROADMAP Brain Feed (3-card composition). Apple
  Developer Program enrollment + Privacy Manifest + iOS
  screenshots @ 1290×2796.

Days 45-51  BETA WEEK 3 — PH PRE-LAUNCH + iOS SUBMISSION
  PH "upcoming" page live, hunter outreach (3-5 candidates),
  iOS TestFlight build, App Store review submitted.

Days 52-59  BETA WEEK 4 — LAUNCH ASSETS + INVITE WAITLIST
  Launch GIF (1280×720), HN/Reddit drafts, indie-hackers post
  drafted, email-to-beta-list "we're going public" prepared.

Day 60 (Mon 2026-07-01)  PUBLIC LAUNCH — PH + HN + REDDIT
  00:01 PST PH submission. 00:05 PST Twitter pin. ~03:00 PST
  "Show HN" post. Reddit posts staggered through morning.
  Reply to every comment within 30 min for first 6 hours.
```

---

# WEEK 1 — DECIDE & PROVISION

**Theme:** No code-feature work this week. The dashboards must be live, the brand must be legally clean, and the navigation must be pruned to MVP before week 2 starts. **The single biggest 30-day risk is starting feature work before infrastructure is paid for.**

## Day 1 — Friday 2026-05-01

**Morning (2 h)**
- 09:00–09:30 — **Trademark check on "Everion Mind"** (USPTO TESS, WIPO Madrid Monitor, ZA-CIPC search — all class-9 software). If any conflicting mark surfaces → STOP and decide rebrand vs proceed before any further work. ([LAUNCH_CHECKLIST.md:689](../LAUNCH_CHECKLIST.md))
- 09:30–10:00 — **Google Play Developer enrollment** ($25, ~10-min form, instant approval most cases / 24h worst case). Use the Google account that owns `com.everionmind.app`.
- 10:00–11:00 — **Vercel Pro upgrade** ($20/mo). Required because `vercel.json` configures `maxDuration: 300` on `gmail.ts` / `llm.ts` / `user-data.ts` and Hobby caps at 60s.

**Afternoon (3 h)**
- 13:00–14:00 — **Supabase Pro upgrade** ($25/mo). At ~3 KB/entry the 500 MB free cap fills at ~150k entries; Pro is 8 GB + daily backups + 7-day retention. Project: `wfvoqpdfzkqnenzjxhui`.
- 14:00–15:00 — **Add `SUPABASE_DB_URL` GitHub Actions secret** for the daily DIY backup. Format in `LAUNCH_CHECKLIST.md:48-50`. Then `gh workflow run db-backup.yml` and `gh release list` to confirm `backup-2026-05-01` lands.
- 15:00–16:00 — **Rotate exposed keys**: Resend, Groq, Upstash REST token, CRON_SECRET, VAPID private key. Update Vercel env. Do NOT rotate Supabase keys (logs everyone out).

**Evening (1.5 h)**
- 17:00–18:30 — **Sentry alerts** (3 rules, ~5 min) per `docs/launch-runbook-alerts-and-dns.md`. Then SPF/DKIM/DMARC for `noreply@everion.smashburgerbar.co.za` per Resend domain panel. Verify mail-tester.com hits 9-10/10.

**End-of-day signal:** every dashboard you'll need this month is paid + provisioned + alerting. Zero net product progress, but every foundation step done. **This is the right shape for day 1.**

## Day 2 — Saturday 2026-05-02

**Half day (4 h)** — operator setup, no code.

- 09:00–10:00 — **LemonSqueezy live store**: create the two variants (`Starter $4.99/mo`, `Pro $9.99/mo`), set `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_STARTER_VARIANT_ID`, `LEMONSQUEEZY_PRO_VARIANT_ID` in Vercel env. Webhook URL → `https://everion.smashburgerbar.co.za/api/lemon-webhook` for now (custom domain comes week 4).
- 10:00–11:00 — **RevenueCat dashboard**: create RC project, add Android app entry only (iOS deferred), set `REVENUECAT_SECRET_API_KEY` + `REVENUECAT_WEBHOOK_AUTH` (server) + `VITE_REVENUECAT_API_KEY_ANDROID` (build-inlined). Configure entitlements `starter` and `pro`. Webhook → `/api/revenuecat-webhook`.
- 11:00–12:00 — **End-to-end web subscription test**: subscribe via LS test mode → portal → cancel. Confirm `lemon-webhook` `subscription_cancelled` fires → `user_profiles.tier` drops to `free`. Cycle through both variants.
- 12:00–13:00 — **Co-admin every dashboard** (bus factor): Vercel team, Supabase org, LS, RC, Play Console, Sentry, PostHog, Resend, Upstash, GitHub. ~10 min × 8.

## Day 3 — Sunday 2026-05-03

**Half day (4 h)** — pruning, start.

Per ROADMAP.md Week 1 days 1-3 ("Prune & Simplify").

- 09:00–11:00 — **Feature-flag multi-brain**: add `ENABLE_MULTI_BRAIN` env (default `false`). Hide `BrainSwitcher`, `CreateBrainModal`, invite flows, `SettingsView/BrainTab` when off. Keeps the schema, kills the surface.
- 11:00–12:00 — **Disable Vault by default**. Move to `Settings > Security`. Replace passphrase modals with inline "unlock vault" link. Vault is high-cognitive-load; first-time users meet it under "Security" not as a top-level concept.
- 12:00–13:00 — **Remove from nav**: `TodoView`, `RefineView`, `VaultView`, Concept Graph. Tasks become entries with checkbox in Memory. Refine output folds into the (yet-to-exist) Feed. Graph becomes 50+ entries easter egg per ROADMAP.

## Day 4 — Monday 2026-05-04

**HARD DEADLINE: Trademark, Play Dev, Vercel Pro, Supabase Pro all green. If anything from Friday/Saturday is red, today is firefighting.**

**Morning (3 h)**
- 09:00–10:00 — **Collapse navigation to 5 items**: `Feed | Capture | Ask | Memory | Settings`. Even though Feed is empty, the slot exists. (Or temporarily route `Feed` → Memory until week 2 wires the real one.)
- 10:00–12:00 — **Default AI provider to Gemini Flash Lite**. Hide provider selector under `Settings > Advanced > AI`. BYOK stays but buried per ROADMAP. Saves ~2KB cold load + reduces decision fatigue at first use.

**Afternoon (3 h)**
- 13:00–15:00 — **Clean `vercel.json` rewrites**. Remove legacy aliases (`/api/delete-entry` → `/api/entries`). Use Vercel logs to confirm none of the legacy paths still receive traffic before deleting.
- 15:00–16:00 — **`npm run typecheck` + Knip clean**. Fix all errors, remove dead exports flagged by Knip. The 73 → 0 warning ratchet is already done; this is dead-code-only.

**Evening (1.5 h)**
- 17:00–18:30 — **Marketing kickoff**: open the Twitter/X build-in-public daily cadence. Tweet 1: "Shipping Everion — second brain + encrypted vault — in 30 days. Day 1: dashboards paid, brand legally clean, navigation pruned." Pin the tweet. Daily 15-min commitment from here.

## Day 5 — Tuesday 2026-05-05

**Morning (3 h)**
- 09:00–10:00 — **Custom domain DNS**: buy `everionmind.com` if not owned. Point to Vercel. Add A + AAAA + CNAME for `www`. SSL Labs grade A check.
- 10:00–12:00 — **Deploy `everionmind.com` → SPA**. Set as Vercel project's primary domain. Update Supabase auth allowed-redirects to include `https://everionmind.com`. Update LemonSqueezy webhook URL to `https://everionmind.com/api/lemon-webhook`. Update RC webhook URL.

**Afternoon (3 h)**
- 13:00–16:00 — **Privacy + ToS legal review**. Email 2-3 SA attorneys for a 30-min review of `src/views/PrivacyPolicy.tsx` + `src/views/TermsOfService.tsx`. Cheap insurance. Get a quote, schedule for week 2 if needed.

**Evening (1.5 h)**
- 17:00–18:30 — **Onboarding stranger test recruit**: identify 3 non-developers (friends/family/neighbours). Schedule 30 min each over weeks 2-3. Promise them a free Pro year + a beer. Cannot be delegated.

## Day 6 — Wednesday 2026-05-06

**Morning (3 h)**
- 09:00–11:00 — **Capacitor android build sanity**: `npm run cap:android` opens Android Studio. Build the existing wrap on a real Android device. Resolve signing issues now while the surface is small. Per LAUNCH_CHECKLIST.md:558 ("Get Android running on a real device first").
- 11:00–12:00 — **AndroidManifest permissions audit** per LAUNCH_CHECKLIST.md:710-712. Should declare: `INTERNET`, `RECORD_AUDIO`, `CAMERA`, `READ_MEDIA_IMAGES` (Android 13+), `POST_NOTIFICATIONS` (Android 13+). **SKIP** `WRITE_EXTERNAL_STORAGE` (triggers extra Play review).

**Afternoon (3 h)**
- 13:00–16:00 — **Magic-link deep linking on Android**. Per LAUNCH_CHECKLIST.md:587-605: register `everion://auth/callback` + `com.everionmind.app://auth/callback` in Supabase, `AndroidManifest.xml` intent filter, verify cold + warm start on real device. **This is the most rejection-prone single item.**

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily. Day-6 tweet: "Native auth deep-linking is fiddly. Why does Supabase magic-link ↔ Android intent filter ↔ Capacitor URL handler need 4 separate config touches? Wrote it up." Link to a public lessons-learned gist.

## Day 7 — Thursday 2026-05-07

**Morning (3 h)**
- 09:00–10:00 — **Bundle size review** (`npm run build`, eyeball `dist/assets/`). Already audited in 2026-04-30 audit; main chunk targets <500 KB gzipped.
- 10:00–12:00 — **Lighthouse audit on production**. Target: ≥90 Performance, ≥95 A11y, ≥95 Best Practices, ≥95 SEO. Mobile + desktop. Fix anything red.

**Afternoon (3 h)**
- 13:00–16:00 — **Week 1 retro + Week 2 plan**. Re-read this doc, mark ✅ what shipped, push slip items into week 2. **Brutal honesty:** if Brain Feed dropped puts you below "definition of done" for week 2, shrink scope further now, not later.

**Evening (1.5 h)**
- 17:00–18:30 — **Saturday/Sunday plan**: pre-write the week 2 deep-work blocks. Reduce decision fatigue at the start of week 2.

### Week 1 — definition of done

- [ ] All 4 dashboards paid + provisioned (Vercel Pro, Supabase Pro, Google Play Dev, GitHub Actions secrets for backup)
- [ ] Trademark check clean
- [ ] Sentry alerts firing on test error
- [ ] SPF/DKIM/DMARC on Resend ≥ 9/10 mail-tester
- [ ] LemonSqueezy + RevenueCat dashboards configured + tested end-to-end on web
- [ ] Navigation pruned to 5 items
- [ ] Multi-brain feature-flagged off
- [ ] Vault demoted to Settings > Security
- [ ] Custom domain `everionmind.com` live + SSL grade A
- [ ] Capacitor Android build runs on real device
- [ ] Android magic-link deep-link works cold + warm
- [ ] Lighthouse green on production
- [ ] 3 stranger onboarding tests scheduled

---

# WEEK 2 — ONBOARDING + INSTRUMENT

**Theme:** Make the first 60 seconds deliver the aha moment, and instrument every step so you can measure it. Per ROADMAP.md, this is the highest-leverage retention work pre-launch.

## Day 8 — Friday 2026-05-08

**Onboarding aha-in-60s, day 1.** Per ROADMAP.md Week 2 days 11-13.

**Morning (3 h)**
- 09:00–12:00 — **Replace generic OnboardingModal flow** per ROADMAP.md:92-101. New steps:
  1. "Welcome. Let's teach your brain."
  2. Bulk-capture: "Paste or type 5–10 things on your mind right now." Single textarea, line-per-thought.
  3. AI splits + categorises (uses existing `parseAISplitResponse` in `src/lib/fileSplitter.ts`).
  4. "Now ask your brain something hard." Guided prompt: "What patterns do you see?"

**Afternoon (3 h)**
- 13:00–16:00 — **AI returns insightful pattern from 5–10 inputs**. Reuse existing `gap-analyst` cron logic in `api/_lib/gapAnalyst.ts`, but in-flow (not waiting for cron).

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily. Marketing nibble: post the new onboarding flow as a 30s screen recording.

## Day 9 — Saturday 2026-05-09

**Half day (4 h)** — onboarding day 2.

- 09:00–11:00 — **Celebration beat + Feed entry** per ROADMAP.md:97-98. After insight returns: "That's your brain working. Imagine it with 6 months of data." Then drop into Memory (since Feed isn't built yet — placeholder for the eventual Feed redirect).
- 11:00–13:00 — **One-tap Google sign-in**. Wire Supabase OAuth Google provider on the existing LoginScreen. Shorten the email/password form below. Delay notification permission until the user hits a feature that uses it.

## Day 10 — Sunday 2026-05-10

**Half day (4 h)** — instrumentation.

- 09:00–11:00 — **PostHog funnel events** per ROADMAP.md:106. Wire 8 events: `signup_completed`, `first_capture`, `first_chat`, `first_insight_viewed`, `day_7_return`, `tier_upgraded`, `tier_downgraded`, `capture_method`, `nav_view_active`. Use existing `posthog-js` lazy-import path; events fire only after consent.
- 11:00–13:00 — **PostHog dashboard**: build the funnel (Signup → First Capture → First Chat → Day 7 Return → Tier Upgrade). Pin to the workspace. **You should see live test events here within 30 minutes of deploy.**

## Day 11 — Monday 2026-05-11

**Morning (3 h)**
- 09:00–10:00 — **Progress checklist on Day 1 Memory view** per ROADMAP.md:100. `✓ Sign up · ✓ First capture · ◯ First insight`. Local-only state in `localStorage`; flips on each milestone.
- 10:00–12:00 — **Skip-but-recoverable**: `Settings > Help > Re-run onboarding` per ROADMAP.md:101. Uses the same flow with current entries.

**Afternoon (3 h)**
- 13:00–16:00 — **Cmd+K / `/` global capture** per ROADMAP.md:108. Captures from anywhere. Floating FAB on mobile, auto-focus textarea, shortcut hint in DesktopHeader.

**Evening (1.5 h)**
- 17:00–18:30 — **Stranger onboarding test #1.** Watch silently for 5 min, screen-record. Note every confusion moment. Don't coach. **Do not fix in real time. Fix the next day.**

## Day 12 — Tuesday 2026-05-12

**Morning (3 h)**
- 09:00–11:00 — Address feedback from stranger test #1.
- 11:00–12:00 — **Strip type selector from capture** per ROADMAP.md:109. Let AI categorise after; reduces capture cognitive load.

**Afternoon (3 h)**
- 13:00–14:00 — **Streak counter** per ROADMAP.md:110. `user_metadata.capture_streak`. Show in Memory header: "🔥 5-day streak · 47 memories".
- 14:00–16:00 — **60-second demo video script + record**. Capture in QuickTime / OBS. Single take, no editing first. ROADMAP.md says this is the marketing asset for landing-hero + Twitter launch.

**Evening (1.5 h)**
- 17:00–18:30 — **Stranger onboarding test #2.**

## Day 13 — Wednesday 2026-05-13

**Morning (3 h)**
- 09:00–11:00 — Address feedback from stranger test #2.
- 11:00–12:00 — **Real-device QA pass** start. Test on real Android phone, Windows Chrome, Mac Safari. PWA install flow on each.

**Afternoon (3 h)**
- 13:00–16:00 — **Onboarding video edit**. Cuts, captions, brand colour grading. Export 1080p + 1080×1920 vertical. The vertical version is for Twitter / app store.

**Evening (1.5 h)**
- 17:00–18:30 — **Stranger onboarding test #3.** This is the last one. If feedback is consistent across all 3 — fix it. If only one stranger said it — note but don't necessarily ship.

## Day 14 — Thursday 2026-05-14

**HARD DEADLINE: Operator setup complete (LS variants, RC dashboard, Play Console subscription products) by EOD.**

**Morning (3 h)**
- 09:00–10:00 — **App Store Connect + Play Console subscription products**. Register `everionmind.starter.monthly` + `everionmind.pro.monthly` in Play Console. Link to RC entitlements. (Apple deferred per assumption #1.)
- 10:00–12:00 — **End-to-end native sandbox test**: subscribe via Play test track → confirm `revenuecat-webhook` fires → DB updates → BillingTab reflects new state.

**Afternoon (3 h)**
- 13:00–14:00 — Address feedback from stranger test #3.
- 14:00–16:00 — **Week 2 retro + Week 3 plan**. Mark ✅ shipped. Slip items push to week 3.

**Evening (1.5 h)**
- 17:00–18:30 — Twitter weekly digest tweet: "Week 2 in review — onboarding rebuilt, PostHog wired, 3 stranger tests done. Shipping Android internal testing next week. Day X of 30."

### Week 2 — definition of done

- [ ] Onboarding aha-in-60s flow live
- [ ] AI returns insight from 5-10 inputs in onboarding
- [ ] One-tap Google sign-in
- [ ] PostHog 8-event funnel live + visible in dashboard
- [ ] Day-1 progress checklist visible in Memory
- [ ] Cmd+K capture works desktop + mobile
- [ ] Streak counter visible
- [ ] 60-second demo video edited + 2 aspect ratios exported
- [ ] 3 stranger onboarding tests done; consistent confusions addressed
- [ ] LS + RC + Play Console subscription products live
- [ ] End-to-end Play test-track subscription works

---

# WEEK 3 — NATIVE + ASSETS

**Theme:** Native build is signed, screenshots and listing copy are paste-ready, Lighthouse is green, demo video is the landing hero.

## Day 15 — Friday 2026-05-15

**Morning (3 h)**
- 09:00–12:00 — **Real-device test pass per LAUNCH_CHECKLIST.md:638-655**. Sign up · magic link login (cold + warm) · logout · app restart · capture text/voice · ask · view entries · file upload · offline state · slow network · expired session · deep-link auth · keyboard behaviour · safe-area · dark/light. ~3h on real Android phone.

**Afternoon (3 h)**
- 13:00–16:00 — Burn down the issues found. Common: keyboard clipping textarea, status-bar overlap, magic-link cold-start race.

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily.

## Day 16 — Saturday 2026-05-16

**Half day (4 h)** — screenshots.

- 09:00–13:00 — **Generate the 8 store screenshots per LAUNCH_CHECKLIST.md:827-841**. Render the actual app in Playwright at `1080×1920` (Android baseline) and `1080×2400` (Android tall). Composite caption band in Figma. **Captions IN the screenshot** because Apple/Play index them.
  - 1. Hero — "your second brain — kept quietly."
  - 2. Capture — "capture in one tap."
  - 3. Voice — "talk to it. it remembers."
  - 4. Recall — "ask anything. it cites."
  - 5. Vault — "for the things you'd be stuck without."
  - 6. The Shape — "see what your thoughts are about."
  - 7. Privacy — "encrypted on your device. yours."
  - 8. Pricing — "free forever. paid only when it earns it."

## Day 17 — Sunday 2026-05-17

**Half day (4 h)** — listing copy + Play Data Safety.

- 09:00–11:00 — **Play Console listing copy**: paste from LAUNCH_CHECKLIST.md:733-737 (title, short description, full description, tags). Match what's in the file — already drafted.
- 11:00–13:00 — **Play Data Safety form** per LAUNCH_CHECKLIST.md:875-881. Match `/privacy`. Email, in-app purchase history, app diagnostics, optional analytics. PostHog as analytics processor (consent-gated). Encryption in transit. Self-service data deletion. No independent security review (yet — flag honestly).

## Day 18 — Monday 2026-05-18

**Morning (3 h)**
- 09:00–10:00 — **Play feature graphic (1024×500)** per LAUNCH_CHECKLIST.md:846. Brand frame, ember dot, tagline.
- 10:00–11:00 — **Adaptive icon** (foreground 432×432 in 1024×1024) per LAUNCH_CHECKLIST.md:845. Use the new `logoNew` mark.
- 11:00–12:00 — **Capacitor splash screen polish**: solid `var(--bg)` with ember dot animating in. Match `index.html`. 5-frame Lottie max 2KB or static PNG.

**Afternoon (3 h)**
- 13:00–14:00 — **App Links file** at `https://everionmind.com/.well-known/assetlinks.json` per LAUNCH_CHECKLIST.md:859. Required for Android intent verification.
- 14:00–16:00 — **Service worker registration gate**: only register SW outside Capacitor's WebView per LAUNCH_CHECKLIST.md:853-857. Already half-done; verify.

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily — share a screenshot.

## Day 19 — Tuesday 2026-05-19

**Morning (3 h)**
- 09:00–10:00 — **Demo account for Play review** per LAUNCH_CHECKLIST.md:860. `review@everionmind.com` with a fixed-password backdoor that skips magic-link + onboarding.
- 10:00–12:00 — **Sign the Android AAB**. Production keystore, secured via Play App Signing (Play handles key custody once enrolled). Build → upload to Play Console internal testing track.

**Afternoon (3 h)**
- 13:00–14:00 — **Internal testing track members**: invite yourself, 1-2 trusted testers. Confirm install works.
- 14:00–16:00 — **End-to-end internal track test**: full install → sign-up → onboarding → capture → ask → subscribe (sandbox) → cancel.

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily.

## Day 20 — Wednesday 2026-05-20

**Morning (3 h)**
- 09:00–11:00 — **Landing.tsx polish + custom domain final**. Hero swap to demo video. Pricing card lock to Hobby/Starter/Pro with Max "Coming soon" (already shipped commit `ab0d062`). FAQ refresh.
- 11:00–12:00 — **Status page link** in landing footer (already shipped 2026-04-29 per checklist).

**Afternoon (3 h)**
- 13:00–14:00 — **Changelog page** at `/changelog`. Markdown-driven, reuses existing markdown render path. Day-30 entry says "Closed beta launched."
- 14:00–16:00 — **Welcome email rendering test** across Gmail, Outlook, Apple Mail, ProtonMail. Use Mailtrap or send to real accounts.

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily.

## Day 21 — Thursday 2026-05-21

**Morning (3 h)**
- 09:00–11:00 — **E2E suite back to green**. Per LAUNCH_CHECKLIST.md:158, 9 of 17 specs were failing in the 2026-04-30 audit. Burn down dialog/capture/delete/onboarding/schedule/search failures. Without green E2E, regressions in week 4 land silently.
- 11:00–12:00 — **Lighthouse re-audit on production**. Mobile FCP <1.8s, LCP <2.5s. If red, profile via Chrome DevTools Performance tab.

**Afternoon (3 h)**
- 13:00–16:00 — **Week 3 retro**. Mark ✅. Push slips to week 4 — you have buffer days now.

**Evening (1.5 h)**
- 17:00–18:30 — Beta invite list. Compile 50-100 names: friends, professional network, early Twitter followers, anyone who's said "I'd use that."

### Week 3 — definition of done

- [ ] Real-device QA pass complete on Android
- [ ] 8 Play screenshots, 1080×1920 + 1080×2400
- [ ] Play Console listing copy + Data Safety form filled
- [ ] Adaptive icon + feature graphic + splash screen
- [ ] AndroidManifest verified (permissions, intent filters)
- [ ] App Links file at `everionmind.com/.well-known/assetlinks.json`
- [ ] AAB signed + uploaded to Play internal testing track
- [ ] Demo account `review@everionmind.com` works
- [ ] Landing.tsx hero = demo video, FAQ refreshed
- [ ] Changelog page at `/changelog`
- [ ] E2E suite ≥ 90% green
- [ ] Lighthouse ≥ 90 Performance, ≥ 95 A11y/BP/SEO

---

# WEEK 4 — SUBMIT + LAUNCH

**Theme:** Submit to Play production review, hold the line on no-new-features, prepare beta invite content.

## Day 22 — Friday 2026-05-22

**HARD DEADLINE: Play Console internal-testing track LIVE with signed AAB.**

**Morning (3 h)**
- 09:00–11:00 — **Final pre-submission gate** per LAUNCH_CHECKLIST.md M5 section.
- 11:00–12:00 — **Submit to Play production review**. Roll out 100% (not staged — closed beta is small enough).

**Afternoon (3 h)**
- 13:00–16:00 — Buffer for any rejection/follow-up. If Play comes back with policy questions same-day, respond same-day. Average review time is 1-7 days; budget the whole afternoon for it.

**Evening (1.5 h)**
- 17:00–18:30 — **Beta invite email** drafted in Resend. From `noreply@everionmind.com`. Subject: "You're in. Everion early access starts now." Body: 4-line value prop + login link + "what to capture first" prompt.

## Day 23 — Saturday 2026-05-23

**Half day (4 h)** — content prep for closed beta.

- 09:00–11:00 — **Beta invite landing page**: dedicated `/beta` route with the demo video at the top, "you're in" copy, password-gated invite codes.
- 11:00–13:00 — **Day-30 launch tweet thread drafts** (3 versions, A/B test later). Drafts only — don't post yet.

## Day 24 — Sunday 2026-05-24

**Half day (4 h)** — Brain Feed v0 (fast-shipping placeholder).

Per assumption #8, Brain Feed is dropped from week 1-3. But you can ship a v0 placeholder this Sunday so the new home isn't empty.

- 09:00–13:00 — **Brain Feed v0** = surface `gap-analyst` cron output + 1 resurfaced memory + capture bar. Single API route `/api/feed`. Single component `FeedView.tsx`. No personalisation logic. Shippable in 4h. Iterate post-beta.

## Day 25 — Monday 2026-05-25

**Morning (3 h)**
- 09:00–10:00 — **Welcome email automation**: Resend transactional template fires on `signup_completed`. Template polished + tested across mail clients.
- 10:00–12:00 — **Onboarding analytics review**: PostHog funnel after 1 week of internal-track data. Look for the highest dropoff. Fix one thing.

**Afternoon (3 h)**
- 13:00–16:00 — **Customer support channel ready**: forward `support@everionmind.com` → your inbox. Add link to Settings + landing footer (already done per checklist line 187, but verify).

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily.

## Day 26 — Tuesday 2026-05-26

**Morning (3 h)**
- 09:00–11:00 — **Stripe → LemonSqueezy migration sanity**: confirm zero references to Stripe in `api/` and `src/`. Already shipped commit `c484030` per LAUNCH_CHECKLIST.md:130, but double-check.
- 11:00–12:00 — **Webhook idempotency dry-run**: send a duplicate LS webhook payload, confirm second one is dropped silently per LAUNCH_CHECKLIST.md:135.

**Afternoon (3 h)**
- 13:00–16:00 — Buffer for Play review feedback if it lands. If approved already, start internal-track → production-track rollout.

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily.

## Day 27 — Wednesday 2026-05-27

**Morning (3 h)**
- 09:00–11:00 — **Final stranger test** (#4 if available) on the latest build. Different person from the 3 in week 2. Catches what you've been blind to.
- 11:00–12:00 — Address feedback.

**Afternoon (3 h)**
- 13:00–16:00 — Buffer.

**Evening (1.5 h)**
- 17:00–18:30 — Twitter daily.

## Day 28 — Thursday 2026-05-28

**HARD DEADLINE: Play Console production review submitted.**

If Play production hasn't reviewed yet, this is the day to escalate via Play Console support. If they've approved, Production rollout flips to 100%.

**Morning (3 h)**
- 09:00–10:00 — **Final Lighthouse + bundle size check** before the gate opens.
- 10:00–12:00 — **Sentry alert thresholds review** — confirm error-rate, new-issue, slow-endpoint rules are firing on test events.

**Afternoon (3 h)**
- 13:00–16:00 — **Beta invite list finalisation**. Aim 50-100 names. Tier them: tier 1 (closest 10) get personal note; tier 2 (next 40) get the form letter; tier 3 (remainder) get the public invite link.

**Evening (1.5 h)**
- 17:00–18:30 — Twitter weekly digest. "Week 4 done. Closed beta opens this weekend."

### Week 4 — definition of done

- [ ] Play Console production review submitted (and ideally approved)
- [ ] Beta invite email + landing page ready
- [ ] Brain Feed v0 placeholder live
- [ ] Welcome email automation works end-to-end
- [ ] PostHog dashboard reviewed; one onboarding fix shipped
- [ ] Beta invite list 50-100 names compiled, tiered

---

# BUFFER + LAUNCH — Days 29-31

## Day 29 — Friday 2026-05-29

**Watch + ship-fix mode.** Don't start anything new.

- Morning: re-run Lighthouse + Sentry health check + check Play Console review status.
- Afternoon: if Play approved, flip Production rollout to 100%. If not, ship any review-feedback fixes within 6 hours.

## Day 30 — Saturday 2026-05-30 — **CLOSED BETA LAUNCH**

**The day:**

- 09:00 — Send tier-1 invite emails (10 names, personal notes).
- 10:00 — Send tier-2 invite emails (40 names, form letter from Resend).
- 11:00 — Public-but-quiet tweet: "Everion is open to early users. Reply for an invite." No PH, no HN yet.
- 12:00–18:00 — Watch Sentry like a hawk. Respond to every signup within 1h. Hand-hold first 50 users.

## Day 31 — Sunday 2026-05-31

- Morning: review the first 24h of beta data (signups, completion rate, errors).
- Afternoon: write up the day-30 retro publicly. Twitter thread: what shipped, what surprised you, what you're fixing first.

## Day 32 — Monday 2026-06-01 — **MILESTONE: PWA + ANDROID + WEBSITE LIVE**

You're not "launched" in the PH/HN sense — that's day 45. But you've hit the 30-day goal: PWA at `everionmind.com`, Android in Play Store, custom domain, billing live, onboarding rebuilt, instrumented end-to-end.

Public launch (PH + HN + content blast) target: **2026-06-15** (day 45). Two weeks of beta feedback first.

---

# DAILY RHYTHM TEMPLATE (every weekday)

| Time | Block | Notes |
| ---- | ----- | ----- |
| 08:00–09:00 | Morning ritual + read this doc | Open EML dashboard, today's section, check yesterday's checkboxes |
| 09:00–12:00 | **Deep work block 1** | Hardest cognitive task of the day. No phone. No Slack. Time-boxed. |
| 12:00–13:00 | Break + admin | Email, Sentry triage, support inbox |
| 13:00–16:00 | **Deep work block 2** | Second hardest task |
| 16:00–17:00 | Comms + ops | Reply to comments, update LAUNCH_CHECKLIST.md, prepare next-day blocks |
| 17:00–18:30 | **Marketing + light dev** | Twitter, demo iteration, content drafting |
| Evening | OFF | Hard cutoff. Sleep matters more than one extra commit. |

**Saturdays:** half-day (4-5h), high-leverage task (operator config, screenshots, onboarding flow).
**Sundays:** half-day (3-4h), lighter cognitive work (review, planning, content drafting).
**One full day off per week** is non-negotiable. Burnout in week 3 sinks the launch. Pick Saturday or Sunday and protect it.

---

# MARKETING TRACK (parallel)

Daily Twitter is the spine. Everything else hangs off it.

## Build phase (days 1-29)

| When | What | Channel |
| ---- | ---- | ------- |
| Daily, 17:00–17:15 | One build-in-public tweet | Twitter/X |
| Weekly, Thursday | Weekly digest tweet | Twitter/X |
| Week 2 day 12 | Demo video v1 | Twitter, landing hero |
| Week 3 day 18 | Final 8 screenshots | Play Store, Twitter, landing |
| Week 4 day 23 | Beta invite landing live | Direct + Twitter |

## Closed beta phase (days 30-60)

| When | What | Channel |
| ---- | ---- | ------- |
| **Day 30 (Sat 2026-05-30)** | "Beta is open. Reply for invite." | Twitter pinned tweet |
| Day 30 evening | Tier-1 invites (10 personal notes) | Email |
| Day 31 | Tier-2 invites (40 form-letter) | Resend |
| Day 32-44 | Daily build-in-public + beta learnings | Twitter |
| Day 35 | **PH "upcoming" page live** | Product Hunt |
| Day 38 | Brain Feed v1 announcement thread | Twitter |
| Day 42 | iOS submission tweet ("on App Store soon") | Twitter |
| Day 45 | **Hunter outreach** (3-5 candidates) | DM/email |
| Day 50 | Indie Hackers "Building in public" post | Indie Hackers |
| Day 52 | Launch GIF preview tweet | Twitter (build hype) |
| Day 55 | Apply to PH "Maker Festival" or featured collections | PH community |
| Day 58 | "Going public Monday" tweet thread | Twitter |
| Day 59 | Email beta list "we're going public, would mean a lot if you upvoted" | Email |

## Public launch day — Day 60 (Mon 2026-07-01)

| Time (PST) | Action |
| ---------- | ------ |
| 00:01 | **PH submission live** (your hunter posts, NOT you) |
| 00:05 | Pin launch tweet on Twitter with PH link |
| 00:10 | Reply to your hunter's PH comment (maker comment: who/why/different) |
| 00:30 | Pre-warmed network (5-10 people) upvote + comment authentically |
| 03:00 | **"Show HN" post** ("Show HN: Everion — second brain with encrypted vault") |
| 06:00 | Reddit r/productivity post |
| 08:00 | Reddit r/PKMS post |
| 09:00 | Email beta list "we're live on PH — link inside" |
| 10:00 | Reddit r/SideProject post |
| 12:00 | Indie Hackers Launch post |
| 14:00 | LinkedIn personal post |
| All day | **Reply to every PH comment within 30 min** for first 6 hours |
| 18:00 | Mid-day Twitter update (rank, traffic spike screenshot) |
| 23:00 | "Thank you" tweet with first-day metrics |

## Product Hunt playbook (specifics)

**Pre-launch (days 30-55):**

1. **Sign up for PH "upcoming"** at `producthunt.com/upcoming` — submit Everion. Free public URL with "Notify me" button. Goal: 200+ signups before launch.
2. **Find your hunter.** Search past hunters of: Reflect, Mem, Notion, Obsidian, Tana, Capacities, Heptabase. DM/email 5-10 of them with: "I'm launching Everion in 3 weeks (PWA + Android, encrypted vault + AI), here's a 60s demo, would you hunt it?" Offer them lifetime Pro. **One yes is enough.**
3. **Build PH karma** — comment on 1-2 PH launches/day during beta. Real comments, not "great launch!" Builds your maker profile so PH doesn't see you as a one-shot.
4. **Twitter following** — every Twitter follower with PH karma is a potential first-hour upvoter. Daily build-in-public tweets compound.

**Launch day mechanics:**

- **00:01 PST submit** (Tuesday-Thursday). Why: full 24h visibility window, weekday traffic, US morning kicks in 6h later.
- **Asset:** 1280×720 GIF or short MP4 video. Static screenshots underperform 2-3x. Show capture → ask → cited answer in 8-12 seconds. Loop seamlessly.
- **Tagline (60 chars max):** value-driven, not feature-driven. Working draft: `"your second brain — kept quietly."`
- **Description (260 chars):** Two-sentence hook. "The fleeting thoughts and the high-stakes facts. One private, encrypted home you can ask anything."
- **Maker comment (within 5 min of going live):** Who you are, why you built it, what makes it different. Personal, not corporate. ~150-250 words.
- **First-hour upvotes weight heaviest.** 5-10 friends primed to upvote AND leave a 1-2 sentence comment within 30 min. **Real PH accounts.** PH detects coordinated voting; shadow-bans on bots.

**The bar to hit:**

- **Top 10 of the day** = featured in PH daily email + sidebar = ~500-2000 signups
- **Top 5** = same + frontpage exposure = ~2000-5000 signups
- **Top 3** = compounding (newsletter mentions for 2-3 weeks) = ~5000-10000 signups

**Day-of engagement is the difference between top 10 and top 30.** Block the entire day. No meetings.

What NOT to do before Day 7 retention is measured (during beta phase):

- Paid ads
- Big PR push
- Influencer outreach
- Long-form content (blog) beyond build-in-public threads

---

# RISK REGISTER

| # | Risk | Probability | Impact | Mitigation |
| - | ---- | ----------- | ------ | ---------- |
| 1 | Play Console rejection on subscription metadata | M | H | Submit AAB by day 21 (Thu Wk3) for 9-day buffer. Demo account `review@everionmind.com` wired. |
| 2 | Trademark conflict on "Everion Mind" | L | XH | Day-1 morning check, hard-block escalation. |
| 3 | Stranger onboarding tests reveal a structural confusion | M | M | Tests scheduled days 11/12/13 — still 17 days of buffer to act. |
| 4 | Magic-link deep-link cold-start race on Android | M | M | Tested day 6 + reverified day 15. Failure mode: drop magic-link from v1, force email/password. |
| 5 | Bundle size regression after onboarding rewrite | L | M | Lighthouse re-run end of week 2. |
| 6 | LemonSqueezy webhook drift causing tier-state mismatch | L | H | E2E test at day 14 + day 26. Webhook idempotency already shipped (`webhookIdempotency.ts`). |
| 7 | Founder burnout week 3 | M | XH | One full day off per week, hard cutoff at 18:30 weekdays. **The single biggest risk.** |
| 8 | iOS scope creep — "let's just add iOS too" | M | XH | iOS = OUT for the 30-day window. Discuss in week 5+ retro. |

---

# TRIPWIRES — what makes me push the launch date

If any of these is true on the date noted, **launch slips 1 week minimum** and we re-plan:

**Build-phase tripwires (days 1-30):**

- Day 7 (2026-05-07): operator setup not complete (LS + RC not configured)
- Day 14 (2026-05-14): onboarding aha-in-60s not delivering an insight in test
- Day 21 (2026-05-21): AAB not signed + uploaded to Play internal testing
- Day 22 (2026-05-22): Play production review not yet submitted
- Day 28 (2026-05-28): Play not approved (Plan B = launch beta as PWA-only, Android slips 3-7 days)

**Beta-phase tripwires (days 30-60):**

- Day 37 (2026-06-06): Day-7 retention < 15% — pause Brain Feed v1 work, fix onboarding instead
- Day 45 (2026-06-14): no hunter signed up to launch you on PH — extend beta or self-hunt (lower ceiling)
- Day 50 (2026-06-19): iOS submission rejected by Apple — fix or drop iOS from day-60 launch
- Day 55 (2026-06-24): PH "upcoming" page < 100 signups — push public launch to day 75 to build waitlist
- Day 58 (2026-06-27): launch GIF / screenshots / maker-comment not finalised — pull all-nighter or push launch 1 week

---

# WHAT TO DECIDE THIS WEEKEND (2026-05-02 → 2026-05-03)

Beyond the 7 critical decisions at the top of this file:

1. **Sub-domain or apex for the public site.** `app.everionmind.com` (sub) vs `everionmind.com` (apex)? Apex is cleaner for SEO + share links. I assume apex.
2. **Twitter handle.** `@everionmind`? `@everion`? Lock now. Build-in-public needs a stable handle.
3. **Beta invite acceptance gate.** Manually approved (tier-1 + tier-2 personal) or open-link (tier-3)?  I recommend manual for first 50 to control quality of feedback.
4. **Will you keep Working/ archived audits visible in EML dashboard during launch?** They're useful for context but visually noisy. Either fine; flag preference.
5. **Domain registrar.** Cloudflare Registrar is the cheapest renewal price. If you bought elsewhere, fine — but don't transfer mid-launch.

---

**Last word:** This is a 30-day plan optimised for *not slipping*. Every block has a definition of done. Every week has a hard deadline. The buffer is 4 days at the end, not slack inside individual weeks. **The way this fails is "I got 80% of week 1 done, I'll catch up next week." You won't. Either accept the slip or cut scope.**

The four week-end retros (days 7, 14, 21, 28) are the only time slips are allowed. Cut scope at the retro, never mid-week.
