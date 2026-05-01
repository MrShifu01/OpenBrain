# Play Console submission — assets, copy, signing, review

**Goal:** every Play Console field, every required asset, every signing step in one runbook so submission day is mechanical execution, not panic.

Day-21 hard deadline: AAB submitted for production review. This doc is what you check off; the week-3 plan is what you do *with* it.

---

## Pre-flight checks (Mon morning of week 3)

| Check | Command / location | Pass means |
| ----- | ------------------ | ---------- |
| Google Play Developer account active | https://play.google.com/console | "Developer profile complete", $25 paid |
| Capacitor build succeeds locally | `npm run build && npx cap sync android && cd android && ./gradlew bundleRelease` | `app/build/outputs/bundle/release/app-release.aab` exists |
| Target SDK ≥ 34 (Google's current minimum) | `android/app/build.gradle` → `targetSdkVersion` | Number is `34` or higher |
| Java + Android SDK versions correct | `cd android && ./gradlew --version` | JDK 17 (or whatever Capacitor 6 requires today) |
| Production keystore exists + password known | `keytool -list -v -keystore everion-release.jks` | Lists exactly one alias |
| Keystore backed up to 3 separate encrypted locations | Manual | Verified — restoring from backup is rehearsed |

If any pre-flight is red, stop and fix before touching submission. Submission with a half-broken local build is the leading cause of "I lost my keystore" stories.

---

## Asset checklist

Drop everything into `assets/play-store/` (gitignored, since some assets are large and Capacitor has its own asset pipeline). Reference path is from project root.

### Icons

| File | Size | Format | Notes |
| ---- | ---- | ------ | ----- |
| `assets/play-store/icon-512.png` | 512×512 | PNG, no alpha, ≤ 1024 KB | The Play Store listing icon |
| `assets/play-store/feature-graphic.png` | 1024×500 | PNG | Renders at the top of the Play Store listing — high-leverage |
| Adaptive icon foreground / background (in-app) | 432×432 each | PNG with alpha | Already in `android/app/src/main/res/mipmap-*/`. Only re-export if the brand mark changed |

**Style rules** (per CLAUDE.md design philosophy):
- Ember dot (`#FF4F1F` or token `--ember`) on dark base (`#0E0E0E` or `--ink`)
- Serif italic wordmark "*Everion Mind*" on the feature graphic
- No gradients. No glow. The brand is calm + austere — Play Store browsers tap on calm

### Screenshots (phones)

8 screenshots, taken on a real Pixel device (NOT an emulator — Play Console rejects fake-feeling shots). Resolution: at least 1080×1920, 9:16 ratio. Order matters — Play Store crops to first 4 in the carousel.

| # | Screen | Caption (overlay or as Play Console caption) |
| - | ------ | -------------------------------------------- |
| 1 | Capture sheet, mid-typing | "Capture in under 5 seconds." |
| 2 | Brain feed home view with resurfaced + gap row | "Your brain, surfacing what matters." |
| 3 | Chat answer with citation chips | "Ask your own brain. Cited answers, never noise." |
| 4 | Vault locked screen | "AES-256-GCM. We can't read what you put inside." |
| 5 | Streak chip + entry grid | "Captured every day for 12 days." |
| 6 | Settings → Brain (single brain shown, not multi-brain) | "Your second brain — kept quietly." |
| 7 | Important memories view (or pinned-entry surface) | "The things you don't lose." |
| 8 | Dark + light side-by-side (not strictly allowed by Play Console — verify formatting) OR Onboarding step 3 | "60 seconds from sign-in to your first answer." |

Save as `assets/play-store/screenshot-{1..8}.png`.

**Caption overlay tooling:** Figma export. Don't add captions in Play Console UI — it's text-rendered server-side and looks visibly different from in-app type.

### Screenshots (tablets — recommended, not required)

2-3 tablet shots (1200×1920 or 1600×2560). Same 8 frames work; just rotate or use a tablet emulator since you don't have a tablet to test on.

---

## Listing copy (paste-ready)

### App name (50 chars max)

```
Everion Mind
```

12 chars.

### Short description (80 chars max)

```
Your second brain — fleeting thoughts and an encrypted vault, all asked in plain language.
```

89 chars — too long. Trim:

```
Your second brain. Fleeting thoughts + encrypted vault. Ask in plain language.
```

77 chars.

### Full description (4000 chars max — write tight)

```
Two halves of one second brain.

A memory feed for fleeting stuff: half-thoughts, voice memos, links you meant to read, photos of receipts, the diary line you scribbled at midnight. AI categorises after, no folders to set up, capture takes under five seconds.

An encrypted vault for high-stakes stuff: ID numbers, gate codes, policy numbers, the alarm panel password, "if I'm not around" notes. AES-256-GCM derived from a passphrase only you know. We can't read it. We can't sell what we can't read.

You ask either half in plain language. The AI grounds answers ONLY in your own past entries and cites them — no general-internet trivia.

Built for the person who's tired of losing their own ID number in three different notes apps. Built for the founder mid-call who needs to recall what a customer said two weeks ago. Built for the parent juggling six gate codes, three school logins, and a mother-in-law's WiFi password.

WHAT'S DIFFERENT

— Capture in under 5 seconds. No folders. AI categorises after.
— Your vault is encrypted client-side. We physically can't read it.
— Cited answers. Every AI response shows which of your entries it pulled from.
— Two halves, one app. The fleeting and the high-stakes don't fight for attention.
— Available on web (PWA), Android, and iOS (App Store coming weeks).

PRICING

Free forever (Hobby tier — your own AI key works).
Starter $4.99/mo for hosted AI.
Pro $9.99/mo for premium models.
Max $19.99/mo (coming soon — frontier AI + unlimited usage + file storage).

PRIVACY

End-to-end encrypted vault. Service-role keys never have access. AI inference uses Gemini's no-data-retention endpoints. Read the privacy policy at everionmind.com/privacy.

Made by one person, for the people who treat their own thoughts as worth keeping.
```

### Tags / categories

- **Primary category:** Productivity
- **Secondary category:** Tools
- **Tags (Play Console allows ~5):** notes, productivity, second brain, encryption, AI assistant

Don't pick "Communication" or "Social" — those buckets attract a different reviewer profile and increase content rating risk.

---

## Data safety form (the most-overlooked field)

Walk through every field methodically. Most apps get rejected here for under-disclosing.

### Data collected

| Type | Collected? | Used for | Shared with third parties? | Optional? |
| ---- | ---------- | -------- | -------------------------- | --------- |
| Email address | Yes | Account creation, magic-link auth | No | No |
| User ID | Yes | App functionality | No | No |
| Photos | Yes (if user uploads) | App functionality (capture) | No | Yes |
| Audio files | Yes (if user records voice memo) | App functionality + transcription | Yes — sent to Gemini for transcription, no retention | Yes |
| Notes (user-generated text) | Yes | App functionality (entries) | No | No |
| Vault contents | NO — encrypted client-side, never leaves the device decrypted | — | — | — |
| App interactions | Yes | Analytics (PostHog), opt-in | No (PostHog is a processor, not third-party-shared) | Yes |
| Device IDs | No | — | — | — |
| Crash logs | Yes | App functionality (debugging) | Yes — Sentry processor, opt-in | Yes |
| Approximate location | No | — | — | — |
| Precise location | No | — | — | — |

### Data security

| Question | Answer |
| -------- | ------ |
| Is your data encrypted in transit? | Yes (HTTPS, TLS 1.3) |
| Can users request data deletion? | Yes (`/api/transfer?action=delete-account`) |
| Do you delete data on account deletion? | Yes, full row + auth row deleted |
| Do you commit to Play Families policy? | Not applicable (not a kids app) |

### Encryption note (call this out explicitly in the description AND data safety summary)

> Vault contents are encrypted client-side using AES-256-GCM with a key derived from the user's passphrase. The server stores only ciphertext — we cannot read vault entries.

---

## Content rating questionnaire

Honest answers:

- **User-generated content?** Yes (entries are UGC) — but private to the user
- **Targeted ads?** No
- **Sensitive content?** No
- **Sharing of UGC with other users?** No (currently — even if `multiBrain` flag is on, sharing is between brains the same user owns)
- **Cryptocurrency / gambling?** No

Should land at **Everyone** or **Everyone 10+**.

---

## Pricing & in-app products

Even though billing is web-only via LemonSqueezy (merchant of record), Play Console still wants the pricing model declared:

- **Pricing model:** Free, with optional subscriptions
- **Subscriptions are managed via:** External (web) — declare this so Play doesn't expect Google Play Billing
- **Currency / region:** All regions, USD

**Important:** if Play Console insists on Google Play Billing as the only allowed in-app purchase mechanism, the contingency is to NOT offer subscriptions inside the Android app at all — keep them web-only and link out via "Manage subscription" → web. Capacitor wraps already do this; verify.

---

## Signing procedure

```bash
# Build the AAB
cd android
./gradlew bundleRelease

# Verify signature
~/Android/Sdk/build-tools/34.0.0/apksigner verify \
  --print-certs \
  app/build/outputs/bundle/release/app-release.aab

# The output should show one signing certificate matching your keystore
```

If the build fails:
- Most-common cause: `signingConfig` not wired in `android/app/build.gradle`. Capacitor scaffolds this; verify it points at the production keystore, not the debug one.
- Second cause: keystore password mismatch. Triple-check the password manager.

**Backup the keystore RIGHT NOW (Tue morning):**

1. Encrypted USB stick — physical
2. Encrypted ZIP in personal cloud storage (Dropbox/iCloud/etc.)
3. Encrypted ZIP in a separate cloud (Google Drive in a different account)

Use a passphrase you'll remember in 10 years. Lose this and you cannot ship updates to the app — you'd have to publish a new app under a new package name. This has killed indie apps.

---

## Internal testing → production review timeline

```
Tue 05-19    Upload AAB to internal testing
                 ↓
             Google automated review (~30-60 min)
                 ↓
             Available to internal testers (you + 2-3 others)
                 ↓
Wed 05-20    Round-trip test on signed-from-Play install
                 ↓
             Stage production release
                 ↓
Thu 05-21    Submit for production review (17:00 PST)
                 ↓
             Google human review (1-7 days, median 2-3)
                 ↓
Sat-Mon      Approval email arrives
                 ↓
Day 30       Closed beta launch on Sat 2026-05-30
```

If review takes > 7 days, you're at day 28 and still pending. Activate the PWA-only contingency:
- Update the landing page to "Android coming any day now"
- Don't tweet "Android is live!" until the email arrives
- Day-30 closed beta proceeds with PWA only — Android joins as soon as approved

Don't email Play Console support to expedite. They don't expedite for indie apps. Just wait.

---

## Common rejection reasons + fixes

| Rejection reason | Fix |
| ---------------- | --- |
| "Privacy policy not accessible" | Confirm `https://everionmind.com/privacy` returns 200 (not 401 — Vercel deployment protection!) and is linked from inside the app |
| "Data safety form incomplete" | Re-run the section above — most apps under-disclose voice/audio data |
| "Target SDK too low" | Bump `targetSdkVersion` in `build.gradle`. Google enforces a minimum (currently 34) |
| "Sensitive permissions over-requested" | Audit `android/app/src/main/AndroidManifest.xml`. Remove anything not actually used (e.g., `READ_PHONE_STATE` if you never read phone state) |
| "App appears to be a copycat" | This is a hard one for second-brain apps with similar visual languages. Mitigation: distinct icon, distinct feature graphic, brand-name uniqueness |
| "Cannot sign in to test" | Provide test credentials in the "App access" section. Use a dedicated test account, not your own. |

For "Cannot sign in to test" — create a test account `play-tester@everionmind.com` (or whatever) with a known password. Add it to a brain that has 5-10 sample entries. List both in the App Access field of Play Console.

---

## Done means (Thu 17:00 PST)

- [ ] Production AAB uploaded and signed
- [ ] Listing 100% complete (every field green)
- [ ] Data safety form submitted
- [ ] Content rating: Everyone or Everyone 10+
- [ ] Test credentials provided in App Access
- [ ] Production review submitted
- [ ] Email confirmation received
- [ ] LAUNCH_CHECKLIST.md updated

If all 8 are checked, week 3 succeeded. If 7, you're submitting Friday morning — tolerable. If 6 or fewer, the day-30 launch is PWA-only-with-Android-coming. That's a real outcome; document it and move on.
