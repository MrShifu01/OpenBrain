# Week 3 — QA + Play Console submission

**Window: Fri 2026-05-15 → Thu 2026-05-21 (day 15 → day 21 of the 30-day arc).**
**Theme: prove the Android build is shippable on real devices, then get it through Google's review with the most buffer possible before the day-30 closed beta.**

This is the highest-stakes operational week of the entire arc. Two decisions determine whether the day-30 beta launches with Android or PWA-only:

1. **Real-device QA finds zero P0 bugs by Tue evening.**
2. **AAB uploaded to Google Play Console internal testing by Wed end-of-day.**

Miss either gate and the Plan B (PWA-only on day 30, Android slips 3-7 days) kicks in. That's not a failure — it's a documented contingency — but the goal this week is to not need it.

---

## North star for the week

> By Thu evening I open Play Console, see "production review submitted", and have one Android device with a signed-from-the-real-keystore install of EverionMind that I can show anyone without flinching.

If a task this week doesn't move that 4-day arc forward, push it.

---

## Five hard outputs

| # | Output | Verifies how |
| - | ------ | ------------ |
| 1 | Android build runs cleanly on 4+ real devices (matrix below) | `spec-android-qa-matrix.md` checklist all green |
| 2 | Play Console listing 100% complete (icons, screenshots, descriptions, content rating, target audience, data safety) | Console "ready for production" green check |
| 3 | Signed AAB uploaded to internal testing track | `bundletool` install + 1 round-trip test from Play Store internal testing link |
| 4 | Production review submitted by Thu 17:00 PST | Google's "submitted" email confirmation |
| 5 | Sentry + Vercel + Supabase pre-flight checks all green | Manual review against `spec-pre-launch-audit.md` (drafted week 4) |

---

## Daily blocks (PST)

### Fri 2026-05-15 — Real-device QA day 1 (Android)

**Goal:** every test in the QA matrix runs on Pixel + Samsung mid-range. Every P0/P1 bug logged + ticketed.

- 09:00–10:00 — Pull a clean Capacitor build. Reset both test devices to fresh installs (uninstall any dev builds, clear data).
- 10:00–13:00 — Run the QA matrix on **Pixel 8** (Android 15): every flow in `spec-android-qa-matrix.md`. Note timings — anything > 3s perceived latency goes on the perf list.
- 14:00–17:00 — Run the QA matrix on **Samsung Galaxy A-series mid-range** (Android 14). Different OEM = different surface; this is where most "works on Pixel, broken on Samsung" bugs surface.
- 17:00–18:00 — Triage. Anything P0 (data loss, crash, auth break) → fix tonight. P1 (visual broken, perf >3s) → tomorrow morning. P2 → after launch.

**Done means:**
- Pixel 8: 100% green or only P2 issues outstanding
- Samsung A-series: same
- Bug list logged in `Audits/2026-05-15-android-qa-day1.md` (auto-discovered by EML dashboard)

**Tripwire:** if either device hits >3 P0 bugs, treat that as a "do not submit Android by day 30" signal. Flag immediately to defer to PWA-only and adjust the week.

---

### Sat 2026-05-16 — Real-device QA day 2 (Android low-end + iOS smoke)

**Goal:** confirm low-end Android works (most-likely beta-user device class). Sanity-check iOS isn't blocked.

- 09:00–13:00 — Run the QA matrix on a **2-3-year-old budget Android** (Android 12-13, < 4GB RAM). Slow networks, low memory, older WebView. This is where service-worker bugs and offline-cache bugs surface.
- 14:00–16:00 — Fix any P0/P1 from days 1-2. Don't add new tests this afternoon — close the loop on what's already on the bug list.
- 16:00–18:00 — **iOS smoke (TestFlight not required yet)**: install the Capacitor iOS build via Xcode on a personal device. Verify magic-link signin works, capture works, biometric vault unlock works. Don't run the full matrix — that's a week-5 task. Just confirm iOS isn't fundamentally broken so week 5 doesn't blindside you.

**Done means:**
- Low-end Android: capture + sync + chat all work, even if perf is 30-50% slower
- iOS smoke: 5 critical paths green; nothing about iOS submission is a panic-rather-than-plan situation

**Commit pattern:** any bug fixes go in as `fix(android): <short>` with the device + Android version in the body.

---

### Sun 2026-05-17 — Asset prep day

**Goal:** every asset Play Console asks for is exported, named correctly, and in the submission folder.

See `spec-play-console-submission.md` for the full list. High-level:

- 09:00–11:00 — App icon (512×512 PNG, no transparency, ≤ 1024 KB). Adaptive icon variants if not already shipped.
- 11:00–14:00 — Feature graphic (1024×500 PNG). Same brand language as the LemonSqueezy checkout — ember flame on dark, "your second brain — kept quietly." in serif italic.
- 14:00–16:00 — 8 phone screenshots (1080×1920 minimum, 16:9 or 9:16). Show: capture, ask, vault unlock, recall, streak chip, settings, brain feed, important memories. Pair each with a one-line caption overlay (no Lorem ipsum).
- 16:00–18:00 — 2 tablet screenshots (optional but recommended for the listing's algorithmic reach). Just rotate the phone shots — Play Console will accept them.

**Done means:**
- `assets/play-store/` folder contains every asset, named per the spec
- Screenshots reviewed against the design philosophy in CLAUDE.md (no OS-native UI showing, design tokens consistent)

**Commit pattern:** `chore(assets): play store icons + screenshots + feature graphic`

---

### Mon 2026-05-18 — Listing copy + Play Console fields

**Goal:** every text field in Play Console is filled with paste-ready copy. No "we'll update later".

Use `spec-play-console-submission.md` as the field-by-field copy bank.

- 09:00–11:00 — Short description (80 chars max).
- 11:00–13:00 — Full description (4000 chars max — but write tight; long descriptions don't help conversion). Sections: hook, dual-nature framing, vault privacy, pricing transparency, who it's for.
- 14:00–15:00 — Privacy policy URL (`https://everionmind.com/privacy`), Terms (`/terms`).
- 15:00–16:00 — Data safety form. **This is the most-overlooked field that gets apps rejected.** Walk through every field with the AES-256-GCM client-side vault story baked in.
- 16:00–17:00 — Content rating questionnaire. Honest answers: no UGC, no targeted ads, encryption is standard, etc. Should land at "Everyone" or "Everyone 10+".
- 17:00–18:00 — **Play Console subscription products.** Per checklist line 140 + 315. Register `everionmind.starter.monthly` + `everionmind.pro.monthly` SKUs in Play Console → Monetization → Subscriptions. Match the LS variant pricing ($4.99 / $9.99). Link to RevenueCat entitlements (`starter` / `pro`) in the RC dashboard.
  - **Note:** if Play Console insists on Google Play Billing as the only allowed in-app purchase mechanism for subscriptions, you may need to declare the subscriptions but route the actual purchase through the web at runtime. Capacitor wraps already do this; verify the BillingTab native flow.
  - **App Store Connect subscription products defer to week 5** (iOS submission window per schedule).

**Done means:**
- Every Play Console field shows green ✓
- Listing preview reads like marketing, not a TODO list
- 2 subscription products registered + linked to RC entitlements

---

### Tue 2026-05-19 — Sign + upload AAB to internal testing

**Goal:** signed AAB lands on Play Console's internal testing track. You install via Play Store internal testing link and round-trip a capture + chat.

- 09:00–10:00 — Verify the keystore. **Backup the keystore + password to encrypted storage in 3 places.** Lose the keystore = can't update the app, ever. Single biggest "you'll regret it later" item.
- 10:00–13:00 — Build the production AAB (`./gradlew bundleRelease`). Sign with the production keystore. Verify signature with `apksigner verify`.
- 14:00–15:00 — Upload to Play Console → Internal testing → Create new release. Add release notes ("First internal testing release"). Save and review.
- 15:00–16:00 — Add yourself + 2-3 trusted testers to the internal testing list (use email addresses they'll install with).
- 16:00–18:00 — Wait for Google's automated review (usually 30-60 min for internal testing). Install via the internal testing link on a fresh device. Capture an entry. Open chat. Lock the vault. Re-open. **All four must work.**

**Done means:**
- AAB signed and uploaded
- Internal testing link works for at least one external tester (not just yourself)
- Round-trip test passes

**Tripwire:** if Google flags the AAB for any reason (signature mismatch, manifest issue, target-API too low), fix Wed and absorb into the buffer. The buffer exists for this.

---

### Wed 2026-05-20 — Production review prep + final fixes

**Goal:** every red flag in Play Console is resolved. Production release is staged but not yet submitted.

- 09:00–11:00 — Review feedback from internal testers. Triage P0 → fix. P1 → fix if < 2h. P2 → defer.
- 11:00–13:00 — Re-run the QA matrix on the internal-testing build (not the dev build). This catches keystore-signing-related bugs that don't appear in dev.
- 14:00–15:30 — Address Play Console pre-launch report items (Google runs an automated security/accessibility scan on every uploaded AAB — fix anything red).
- 15:30–17:00 — **Subscription cancellation E2E test on internal-testing build.** Per checklist line 144 + 146. From the signed-from-Play install:
  1. Subscribe to `everionmind.starter.monthly` via in-app purchase (Play sandbox handles test cards).
  2. Confirm the RevenueCat webhook fires. Check RC dashboard webhook log.
  3. Confirm `user_profiles.tier` updates to `starter`.
  4. Cancel via Play Settings → Subscriptions.
  5. Confirm RC `subscription_cancelled` webhook fires.
  6. Confirm `BillingTab.tsx` reflects the new state on next mount (still active until `current_period_end`, then drops to free).
  - **Important:** week 4 covers the parallel LemonSqueezy web cancellation E2E. Today's test is RC-only since we have signed Android in hand.
- 17:00–18:00 — Stage the production release in Play Console. Don't submit yet — submit Thursday morning so you have one night of sleep with the build untouched in case anything surfaces.

**Done means:**
- Production release staged with the same AAB as internal testing
- Pre-launch report all green
- Internal tester list cleared (no broken installs left)
- Android subscription cancellation flow E2E green (or documented gap — fix in week 4)

---

### Thu 2026-05-21 — Submit production review (HARD DEADLINE per schedule)

**Goal:** "Submitted for review" status by 17:00 PST. Don't let this slide to Friday — Google often takes 1-7 days, and Sat-Sun reviewers are slower.

- 09:00–10:00 — Final build sanity. Same AAB as Tue/Wed. Don't change the build today.
- 10:00–11:00 — Hit "Submit for review" in Play Console. Read every confirmation page slowly.
- 11:00–13:00 — Check Sentry, Vercel, Supabase one more time. The first 24h of submitted-but-not-yet-approved is when "oh we forgot to disable the staging Vercel env var" bugs surface.
- 14:00–16:00 — Update `EML/LAUNCH_CHECKLIST.md`: tick off Play Console submission, add a tracking row for review status.
- 16:00–17:00 — Tweet build-in-public: "Submitted to Play Store today. Reviewing 1-7 days. Day-30 closed beta on schedule." Builds anticipation; gives the community a marker.
- 17:00–18:00 — End-of-week-3 retro. Write `Working/2026-05-21-week-3-retro.md`. What shipped, what slipped, what to change in week 4.

**Done means:**
- Play Console shows "Submitted for review" or higher status
- LAUNCH_CHECKLIST.md updated
- Retro doc written

**Tripwire:** if for any reason the AAB cannot be submitted by 17:00 Thu — submit Fri morning (still ahead of schedule), but flag in MEMORY.md that the day-30 launch may need PWA-only contingency.

---

## Risk register for the week

| Risk | Likelihood | Mitigation |
| ---- | ---------- | ---------- |
| Real-device QA finds a P0 bug late Sat | Medium | Sat eve is the hard cutoff for stop-or-defer Android — make the call by 18:00 Sat |
| Keystore lost or password forgotten | Low (catastrophic) | Backup to 3 encrypted locations Tue morning before signing |
| Play Console pre-launch report flags accessibility | Medium | Run a manual a11y audit Sat in parallel (focus order, contrast, font scaling) |
| Google review > 7 days | Low | Submit Thu — gives 9 days of buffer to day 30. If review is still pending day 28, switch to PWA-only with Android-coming-soon banner |
| Data safety form mis-filled | Medium | Have a friend who's submitted apps before review the form Mon evening before saving |
| Capacitor wrap differs from web build (e.g., service worker behavior, deep links) | Medium | Mon-Tue QA must include EVERY auth flow (magic link, deep link, biometric vault) on Android |

---

## Sub-specs referenced from this plan

| Spec | What it covers |
| ---- | -------------- |
| [spec-play-console-submission.md](spec-play-console-submission.md) | Asset list, listing copy templates, signing procedure, review timeline |
| [spec-android-qa-matrix.md](spec-android-qa-matrix.md) | Device list, test flows, sign-off format, what counts as P0/P1/P2 |

(`spec-pre-launch-audit.md` lands week 4 — security/perf/content sweep doesn't need to be spec'd until day 24-26 when the actual audit runs. Drop a `.md` into `Audits/` then.)

---

## What does NOT happen this week

These are real temptations; resist them.

- ❌ **Brain Feed v1 / streak refinements / Cmd+K polish.** Anything not in the QA matrix is a feature-creep risk in the 7 days before Play Console submission.
- ❌ **iOS submission work** (beyond the Sat smoke test). iOS goes week 5-6 per the schedule. Touching it this week splits attention.
- ❌ **Marketing content beyond the build-in-public tweets.** PH outreach, weekly digest, hunter pings — all stay on their normal cadence (Wed/Fri); don't accelerate.
- ❌ **Refactors.** Every refactor on the eve of submission is a bug vector for an issue you'll find at 23:00 the night before launch.

If a beta-tester from week 2 reports a bug — fix it only if it's in the QA matrix. Otherwise it goes to `EML/Audits/post-launch-followups.md`.

---

## Verification at end of week

Open the dashboard at `localhost:5174`. The "Working" group should show:
- Week 3 plan doc
- 2 sub-specs (play-console-submission, android-qa-matrix)
- Week 3 retro doc

`Audits/` group should show:
- A `2026-05-15-android-qa-day1.md` audit
- Possibly a `2026-05-16-android-qa-day2.md` audit
- A `2026-05-19-internal-testing-feedback.md` audit if the testers found anything

Play Console should show:
- ✅ All listing fields green
- ✅ AAB uploaded + signed
- ✅ Internal testing track active
- ✅ Production review submitted

If all three are true on Thu evening, you're 9 days clear of the day-30 launch with the highest-risk operational item behind you.
