# Capacitor build runbook

How the web app gets wrapped into iOS / Android shells, and how to release a new build to TestFlight / internal testing.

> **Status as of 2026-05-05**: Capacitor scaffolded; Android shell ready for keystore wiring + first AAB. iOS deferred to post-launch sprint (see `EML/LAUNCH_CHECKLIST.md` § Post-launch — iOS launch sprint).

## Architecture

The Vite web app is the source of truth. Capacitor wraps `dist/` (the built web bundle) into a native shell:

- **iOS**: Xcode workspace at `ios/App/App.xcworkspace`
- **Android**: Gradle project at `android/`
- **Sync**: `npx cap sync` after every web build copies `dist/` into both shells and applies `capacitor.config.ts`

Native plugins (push, biometric, IAP via RevenueCat) bridge to native APIs. Everything else runs as the same web code.

## Initial setup (one-time)

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "Evara Mind" com.smashburgerbar.everionmind --web-dir=dist

# Add platforms
npx cap add ios
npx cap add android

# Native plugins
npm install @capacitor/push-notifications
npm install @capacitor/preferences
npm install @capacitor/biometric  # for vault PIN biometric
npm install @revenuecat/purchases-capacitor
```

## Per-release flow

```bash
# 1. Build the web bundle
npm run build

# 2. Sync into native shells
npx cap sync

# 3. iOS — open Xcode and Archive
npx cap open ios
# In Xcode: Product → Archive → Distribute → App Store Connect → Upload

# 4. Android — assemble release AAB
cd android && ./gradlew bundleRelease
# Upload android/app/build/outputs/bundle/release/app-release.aab to Play Console

# 5. Update build numbers BEFORE archiving (both platforms)
# iOS: Xcode → target → General → Identity → Build (auto-increment via Xcode setting)
# Android: android/app/build.gradle → versionCode + versionName
```

## Android signing — one-time keystore setup

The keystore is the single most fragile artifact in the entire mobile pipeline. Lose it and you cannot ship updates ever — Google rejects any future AAB signed with a different key, and the only recovery is republishing under a new package name (extinction-level event for an indie app). Treat this section like a security procedure.

### 1. Generate the production keystore

```bash
cd android
keytool -genkey -v -keystore everion-release.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias everion
```

Prompts (answer carefully — these go on every AAB):
- **Keystore password**: 20+ chars, store in 1Password.
- **Key password**: same as keystore password (simpler).
- **Common name**: `Christian Stander`
- **Organisational unit**: `Everion Mind`
- **Organisation**: `Everion Mind` (or the (Pty) Ltd name once registered)
- **Locality**: `Vereeniging`
- **State**: `Gauteng`
- **Country code**: `ZA`

Validity 10000 days = 27.4 years. Long-lived because rotating keystores is a nightmare.

### 2. Wire `keystore.properties`

```bash
cp android/keystore.properties.example android/keystore.properties
# edit android/keystore.properties — replace the REPLACE_ME placeholders
```

Reference: `android/keystore.properties.example`. The `.gitignore` already excludes `keystore.properties` and `*.jks`.

`android/app/build.gradle` reads from this file at build time (added 2026-05-05). If the file is missing, the release build falls back to debug signing so `./gradlew assembleDebug` still works in CI.

### 3. Back up to 3 separate encrypted locations

Mandatory. Pick three of:
- Encrypted USB stick — physical (locked drawer)
- Encrypted ZIP in personal cloud (Dropbox / iCloud)
- Encrypted ZIP in a separate cloud (Google Drive in a different account)
- Encrypted ZIP in 1Password as a binary attachment

Use a passphrase you'll remember in 10 years. If your house burns down AND your laptop dies AND one cloud goes down, you still have the keystore.

### 4. Verify the AAB signs

```bash
cd android
./gradlew bundleRelease
~/Android/Sdk/build-tools/<version>/apksigner verify \
  --print-certs \
  app/build/outputs/bundle/release/app-release.aab
```

Output should show one signing certificate matching your keystore SHA-256.

### 5. Extract the SHA-256 fingerprint for App Links

```bash
keytool -list -v -keystore android/everion-release.jks -alias everion \
  | grep "SHA256:" \
  | head -1 \
  | awk '{print $2}'
```

Paste the output (colons and all) into `public/.well-known/assetlinks.json`, replacing `REPLACE_WITH_PRODUCTION_KEYSTORE_SHA256_FINGERPRINT`. Deploy. Verify the file is reachable:

```bash
curl https://everionmind.com/.well-known/assetlinks.json
```

Then validate via Google's tester: <https://developers.google.com/digital-asset-links/tools/generator>.

Once validated, flip `android:autoVerify="false"` to `"true"` on the App Link intent-filter in `android/app/src/main/AndroidManifest.xml` and rebuild. Verify on a real device:

```bash
adb shell pm verify-app-links --re-verify com.everionmind.app
adb shell pm get-app-links com.everionmind.app
# STATE_VERIFIED = success; STATE_FAIL = fingerprint mismatch or 404
```

## Demo review-tester account (Play Console App Access)

Play Console requires test credentials so reviewers can sign in past auth. The setup is automated:

```bash
REVIEW_TESTER_EMAIL=play-tester@everionmind.com \
REVIEW_TESTER_PASSWORD='your-strong-12+-char-pw' \
SUPABASE_URL=$SUPABASE_URL \
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
node scripts/setup-review-tester.mjs
```

What it does (idempotent — safe to re-run):
1. Creates `play-tester@everionmind.com` user (or refreshes the password if exists).
2. Marks `user_profiles.onboarding_completed=true` so the OnboardingModal doesn't gate the reviewer.
3. Provisions a personal brain.
4. Seeds 6 curated sample entries spanning note / todo / person / reminder so the app feels populated on first open.
5. Writes an `audit_log` row each run.

Paste the email + password into Play Console → App Access → Add login credentials. Pick "All other apps", point at the sign-in URL of the production app, fill the credentials.

Refresh the password (and re-run the script) any time the credentials are exposed or before each major release.

## Version-bump rules

- **Patch (x.y.Z)** — bug fix only, no new features. Web-only change can ship without bumping native build (just `vercel deploy --prod`).
- **Minor (x.Y.0)** — new feature, behaviour change, schema migration. Bump native build, ship to TestFlight + internal testing.
- **Major (X.0.0)** — paradigm shift, breaking change, redesign. Bump native, full release notes, marketing pre-announcement.

## TestFlight / Internal Testing flow

### iOS (TestFlight)
1. Upload build (above)
2. App Store Connect → TestFlight tab → wait for processing (5–15 min)
3. Add testers (internal team or external via group)
4. Testers install via TestFlight app on their device
5. Monitor crashes via Xcode Organizer

### Android (Play Console)
1. Upload AAB (above)
2. Play Console → Internal testing track → Create release → Upload AAB
3. Add testers via email list
4. Testers install via Play Store on their device (after opting into internal track)
5. Monitor crashes via Play Console → Quality → Crashes & ANRs

## Native plugin gotchas

### Push (`@capacitor/push-notifications`)
- iOS requires a Push Notifications capability + APNs key in App Store Connect
- Android requires a Firebase project + `google-services.json` at `android/app/`
- Web Push (browser) uses VAPID separately — different code path
- Background mode "Remote notifications" must be enabled in Xcode

### Biometric (vault PIN biometric)
- iOS: Face ID requires `NSFaceIDUsageDescription` in `Info.plist`
- Android: BiometricPrompt API; no Info.plist equivalent
- WebAuthn fallback for browser users (separate code path)

### IAP (`@revenuecat/purchases-capacitor`)
- Sandbox accounts on both platforms for testing
- Production IAP requires the legal entity (App Store Tax form on Apple, Merchant Account on Google)
- Receipts validated server-side via `REVENUECAT_SECRET_API_KEY`

## CI for native builds

Currently web-only on Vercel. Native builds are manual (run on local machine, archive, upload).

Post-launch options:
- **EAS Build** (Expo) — works for Capacitor too; requires migrating to managed signing
- **Codemagic** / **Bitrise** — Capacitor-friendly, $X/month
- **GitHub Actions with macOS runner** — for iOS; expensive in minutes; requires manual signing setup

For solo pre-launch, manual is fine. Revisit when shipping multiple times per week.

## Debugging

### Web Inspector (iOS Safari)
1. iPhone Settings → Safari → Advanced → Web Inspector ON
2. Mac Safari → Develop → <iPhone name> → app webview
3. Live console + DOM access for debugging the web layer inside the native shell

### Chrome DevTools (Android)
1. Phone Developer Options → USB debugging ON
2. Connect to Mac/PC
3. `chrome://inspect` → identify the webview → Inspect

### Native crash logs
- **iOS**: Xcode → Window → Devices & Simulators → select device → View Device Logs
- **Android**: `adb logcat` while the app is running

## Pre-launch checklist

- [ ] iOS app builds + runs on a real device
- [ ] Android app builds + runs on a real device
- [ ] Push notifications work end-to-end on both platforms (test via `Test Push` GitHub workflow)
- [ ] Biometric vault unlock works on iOS Face ID, Android fingerprint
- [ ] IAP purchase succeeds in sandbox on both platforms
- [ ] Universal Links resolve correctly for invite emails
- [ ] App icon renders correctly at all sizes (Xcode shows preview)

## References
- `Mobile/ios-submission.md` — App Store Connect submission
- `Specs/play-console-submission.md` — Play Console submission
- `Specs/billing-revenuecat.md` — **RevenueCat SDK integration spec** (paywall, customer center, webhook tier sync, sandbox test flow, env vars)
- Capacitor docs: <https://capacitorjs.com/docs>
- RevenueCat Capacitor docs: <https://www.revenuecat.com/docs/getting-started/installation/capacitor>
