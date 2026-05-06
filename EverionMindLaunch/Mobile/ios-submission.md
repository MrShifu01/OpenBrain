# iOS App Store submission runbook

Counterpart to `Specs/play-console-submission.md`. Every Apple-side field, every required asset, every signing step in one place so submission day is mechanical.

## Pre-submission gate

Don't even open App Store Connect until:
- [ ] App ID registered in Apple Developer (`com.smashburgerbar.everionmind` or whatever final brand)
- [ ] Distribution certificate + provisioning profile generated (Xcode handles automatically with managed signing)
- [ ] Apple Developer account in good standing ($99/year paid)
- [ ] Capacitor build is producing a valid `.ipa` (`npx cap sync ios && npx cap open ios` → Archive in Xcode)
- [ ] TestFlight internal-test build has been installed on at least one real device by you

## App Store Connect — required fields

### App Information
- **Name**: Evara Mind (or final brand). Max 30 chars.
- **Subtitle**: "Private AI memory for life admin." Max 30 chars.
- **Bundle ID**: matches the iOS app target.
- **SKU**: stable internal ID (e.g. `evara-mind-001`). Never changes.
- **Primary category**: Productivity
- **Secondary category**: Utilities (or Lifestyle)

### Pricing & Availability
- **Price tier**: Free with in-app purchase
- **Availability**: All regions (later: restrict if any region has legal exposure)
- **Pre-orders**: skip for first launch

### App Privacy (the long one)

Apple wants every type of data you collect, why, and whether it's linked to identity.

**Data collected**:
- Email address — for sign-in (linked to user, used for app functionality)
- Name — optional, user-provided (linked, used for personalization)
- User content (notes, files, audio) — linked, used for app functionality
- Device ID — linked, used for analytics + push notifications
- Usage data (page views, button taps) — linked, analytics

**Data NOT collected** (but Apple still wants you to declare these as "no"):
- Health & Fitness data
- Financial info (we use LemonSqueezy/RevenueCat — they handle card data, not us)
- Sensitive info (race, religion, etc.)
- Location

**Tracking**: declare "No" — we don't follow users across apps/sites for ads. (If you ever add Meta Pixel, this changes.)

### App Tracking Transparency (ATT)

Since we declared "No tracking," we don't need to show the ATT prompt. **But**: if you ever ship Meta ads with conversion tracking via SDK, you'll need to flip this and show the prompt before the SDK init.

### In-App Purchases (RevenueCat)

For each tier (Starter, Pro, Max):
- **Reference Name**: e.g. `evara-pro-monthly`
- **Product ID**: matches `REVENUECAT_PRO_PRODUCT_ID` env var
- **Type**: Auto-Renewable Subscription
- **Subscription Group**: "Evara Mind Subscriptions" (one group, three tiers)
- **Price**: pick from Apple's tier table closest to R49/R499 etc.
- **Localized name + description** for every supported language (English at minimum)
- **Review screenshot**: 1024x1024 image showing the purchase screen in-app
- **Review notes**: short — "Tap Pricing → Pro to trigger purchase."

### App Review Information
- **Sign-in account**: create a real test account (email + password) with sample data; provide credentials to Apple
- **Notes**: short — "Sign in with the test account. Tap Capture, type 'license expires 14 August 2026,' then tap Chat and ask 'when does my license expire?' to see the core loop."
- **Demo video**: optional but recommended; 30s of the core loop

### Version Information
- **Version**: 1.0.0 (then bump per release)
- **Build**: auto-incremented by Xcode
- **What's new**: "Initial launch. Your private AI memory for real life — documents, expiry dates, family info, reminders, and important things you can't afford to forget."

## Required assets

### App icon
- 1024x1024 PNG (no alpha, no rounded corners — Apple rounds them)

### Screenshots (per device tier)
Apple requires at least one tier; ideally 6.7" (latest iPhone) and one iPad size.

- **6.7" iPhone Pro Max** (1290 x 2796) — 3 to 10 screenshots
- **6.5" iPhone Plus** (1284 x 2778) — auto-derived if you only upload Pro Max
- **5.5" iPhone** (1242 x 2208) — required if you ever fall back to it (skip for first launch — only support iPhone X+)
- **iPad Pro 12.9"** (2048 x 2732) — required if app is universal; skip if iPhone-only

**Captions** (overlay text on screenshots, all in the same Apple-template style):
1. Your private AI memory
2. Remember expiry dates
3. Find documents instantly
4. Ask your life admin
5. Keep family info together

### App Preview video (optional, recommended)
- 15–30 seconds, 1080x1920 portrait MP4
- 30s storyboard from `marketing/seo-marketing-playbook.md` § 18:
  1. User adds driver's licence expiry
  2. User uploads a policy PDF
  3. User asks: "When does my licence expire?"
  4. Evara answers with source
  5. User sees reminder
  6. End card: "Your private memory for real life."

### Marketing URL
- <https://everion.smashburgerbar.co.za> (or final brand domain)

### Support URL
- <https://everion.smashburgerbar.co.za/support> or `mailto:stander.christian@gmail.com`

### Privacy Policy URL
- <https://everion.smashburgerbar.co.za/privacy> — must be live and reachable BEFORE you submit. Apple checks.

### Terms of Service URL (EULA)
- We use Apple's standard EULA by default. If you want a custom one, there's a checkbox.

## Capacitor / build config

### `capacitor.config.ts` essentials
```ts
{
  appId: 'com.smashburgerbar.everionmind',  // matches Apple Developer App ID
  appName: 'Evara Mind',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    scheme: 'EvaraMind',  // for deep links
  }
}
```

### Info.plist additions
- `NSCameraUsageDescription` — "Capture documents and receipts." (if camera is used)
- `NSPhotoLibraryUsageDescription` — "Attach images to your memories."
- `NSUserNotificationsUsageDescription` — covered by the system push prompt.

### Capabilities (Xcode → Signing & Capabilities)
- Push Notifications
- Sign in with Apple (if added; not required for v1)
- Background Modes → Remote notifications (for Web Push delivery)

### Universal Links (for invite-email click-through)
- Configure `apple-app-site-association` JSON at `https://everion.smashburgerbar.co.za/.well-known/apple-app-site-association`
- Format: `{ "applinks": { "apps": [], "details": [{ "appID": "TEAMID.com.smashburgerbar.everionmind", "paths": ["/invite/*", "/share/*"] }] }}`

## Submission steps

1. **Archive in Xcode** — Product → Archive
2. **Distribute App** → App Store Connect → Upload
3. Wait 5–15 minutes for processing
4. **App Store Connect** → My Apps → Evara Mind → Build → select uploaded build
5. Fill every required field (above)
6. **Save**, then **Submit for Review**
7. Wait. Average review time is 24–48h for a first submission. Can be longer if Apple flags something.

## Common rejection reasons (and how to avoid)

- **Guideline 5.1.1** — Privacy: missing privacy policy URL. Make sure it's live and reachable.
- **Guideline 4.0** — Design: app crashes on launch. Test on a real device, not just simulator.
- **Guideline 2.3.10** — Mention of other platforms in screenshots. Don't show "Also on Android."
- **Guideline 3.1.1** — IAP gates content not paid for. Make sure free-tier limits in `Legal/pricing-billing.md` match what Apple sees.
- **Guideline 5.1.2** — Sign-in required to access app. We're fine — Sign-in with email/Google works without payment.
- **App Tracking Transparency mismatch** — declared "no tracking" but ATT framework imported. Make sure the SDK isn't accidentally linked.

## Post-launch

- **Product Page Optimization** — A/B test icon + screenshots + preview video. Apple supports this natively in App Store Connect.
- **App Store search ads** — separate Apple Search Ads account once you have install conversion data.
- **Reviews** — respond to every review in the first 90 days. Apple weights this in ranking.

## References

- `Specs/play-console-submission.md` — Android counterpart
- `marketing/seo-marketing-playbook.md` § 18 (App Store / Play Store strategy)
- Apple Developer docs: <https://developer.apple.com/app-store/>
- App Store Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
