# Capacitor build runbook

How the web app gets wrapped into iOS / Android shells, and how to release a new build to TestFlight / internal testing.

> **Stub**: this doc captures the high-level flow today. Fill in concrete commands once Capacitor is integrated (currently still web-only on launch path).

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
- Capacitor docs: <https://capacitorjs.com/docs>
- RevenueCat Capacitor docs: <https://www.revenuecat.com/docs/getting-started/installation/capacitor>
