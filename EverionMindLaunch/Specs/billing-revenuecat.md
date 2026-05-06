# Billing — RevenueCat (mobile IAP) integration spec

> **Status:** code shipped 2026-05-06 (commit `3814d13`). Dashboard setup, store products, paywall design, and sandbox testing **NOT YET DONE** — see Operator checklist below.
>
> **Related docs:**
> - `Legal/pricing-billing.md` — high-level commercial model + provider split
> - `Ops/env-vars.md` — full env var reference
> - `Ops/vendors.md` — RevenueCat account/contact details
> - `Mobile/capacitor-build.md` — native build flow
> - `Mobile/ios-submission.md` — App Store review notes
> - `Specs/play-console-submission.md` — Google Play submission

## Why RevenueCat (and not direct StoreKit / Play Billing)

Apple and Google both require their own IAP for digital goods. RevenueCat sits in front of StoreKit / Play Billing and gives us:
- One SDK + dashboard for both platforms.
- Server-validated receipts (no client-side trust).
- Webhook-driven tier sync into our Postgres.
- Hosted, App-Store-compliant paywall (T&Cs, privacy links, restore button — all required for review).
- Customer Center (cancel / change plan / refund-request / contact support) hosted in-app.

**Web stays on LemonSqueezy** (cheaper, MoR for VAT/tax). The two providers bridge via the LemonSqueezy webhook calling RevenueCat's promotional-entitlement API — a user who paid on web is recognised as paid on mobile.

## Architecture

```
┌──────────────┐         ┌─────────────────┐         ┌────────────────┐
│ Native app   │  IAP    │ App Store /     │ receipt │  RevenueCat    │
│ (Capacitor)  │ ──────► │ Play Store      │ ──────► │  backend       │
└──────────────┘         └─────────────────┘         └───────┬────────┘
       ▲                                                     │ webhook
       │ presentPaywall()                                    ▼
       │ presentCustomerCenter()                  ┌─────────────────────┐
       │ logIn(supabase user.id)                  │ /api/revenuecat-    │
       │ CustomerInfo listener                    │   webhook (Vercel)  │
       │                                          │ → user_profiles     │
       │ ◄────── Optimistic isPro flip ───────────┤   .tier = 'pro'     │
       │                                          └─────────────────────┘
       │                                                     ▲
       │                                                     │ reads tier
       │  ┌───────────────────────────────┐                  │
       └──┤ useSubscription() hook        │ ◄────────────────┘
          │ (canonical tier = SOT)        │
          └───────────────────────────────┘
```

**Two layers of state:**

1. **Optimistic (client)** — `useRevenueCatEntitlement()` listens to RC's CustomerInfo updates. Flips `isPro=true` the millisecond the SDK confirms a purchase, before the webhook lands.
2. **Canonical (server)** — `useSubscription()` reads `user_profiles.tier` from Supabase. Updated by the webhook handler 1-3s after purchase. This is the source of truth for cross-device tier checks (server gates, useSubscription on a different device, etc.).

If the two ever disagree, **canonical wins** — the optimistic layer is purely a UX paint-over for the post-purchase moment.

## Files

| File | Purpose |
|---|---|
| `src/lib/revenuecat.ts` | SDK wrapper. All exports no-op on web. Exposes: `configureRevenueCat`, `loginRevenueCatUser`, `resetRevenueCatUser`, `getCustomerInfo`, `hasProEntitlement`, `getCurrentOffering`, `purchasePackage`, `restorePurchases`, `presentPaywall`, `presentCustomerCenter`, `addCustomerInfoListener`. Constants: `ENTITLEMENT_ID = "everion_mind_pro"`. |
| `src/hooks/useRevenueCatEntitlement.ts` | React hook. Subscribes to CustomerInfo updates, exposes `{isPro, customerInfo, isLoading, isNativePlatform, openPaywall, openCustomerCenter, restore}`. |
| `src/Everion.tsx` | Bootstraps RC at app boot (`configureRevenueCat` → `loginRevenueCatUser(user.id)`). Re-logins on `SIGNED_IN`. Logs out on `SIGNED_OUT`. |
| `src/components/settings/BillingTab.tsx` | Native checkout flow now calls `presentPaywall()` (RC-hosted UI). `handleManage` calls `presentCustomerCenter()` on native. |
| `api/user-data.ts:handleRevenueCatWebhook` | Server side. Validates `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>`. Idempotency via Upstash `SET NX` (`revenuecat:event:<id>`, 24h TTL). Resolves `app_user_id` → `user_profiles` row. Maps RC entitlement state → tier (`pro`, `starter`, `free`). Drops `PROMOTIONAL` store events (those originated from the LS bridge — re-applying would echo-loop). |

## Operator setup checklist

**This is the work the dashboard / store consoles need before native checkout works.**

### A. RevenueCat dashboard

- [ ] Create project (or use existing).
- [ ] **Apps** → add iOS app — bundle id `com.everionmind.app`. Public SDK key starts with `appl_`.
- [ ] **Apps** → add Android app — package id `com.everionmind.app`. Public SDK key starts with `goog_`.
- [ ] **Products** → connect App Store Connect (with App Store Connect API key). Import: `monthly`, `yearly`, `lifetime`.
- [ ] **Products** → connect Google Play (service account JSON). Import: `monthly`, `yearly`, `lifetime`.
- [ ] **Entitlements** → create one entitlement, identifier `everion_mind_pro`. Attach all three products to it.
  - This identifier is hard-coded in `src/lib/revenuecat.ts:ENTITLEMENT_ID`. If you choose a different name, update the constant.
- [ ] **Offerings** → create offering `default`. Add packages `$rc_monthly`, `$rc_annual`, `$rc_lifetime` mapped to the products. Mark as Current.
- [ ] **Paywalls** → Editor → New Paywall → V2 Paywall. Attach to default offering. Design once, no code change.
- [ ] **Webhooks** → URL `https://everion.smashburgerbar.co.za/api/revenuecat-webhook`, Authorization Header `Bearer <REVENUECAT_WEBHOOK_AUTH>` (same value as the env var). Test with a sandbox event.
- [ ] **API Keys** → Settings → grab the **Secret API key** for `REVENUECAT_SECRET_API_KEY` (server-side; used by the LemonSqueezy bridge for promotional entitlement grants).

### B. App Store Connect (iOS)

- [ ] Bundle id `com.everionmind.app` registered.
- [ ] Capability: In-App Purchase enabled.
- [ ] Subscription group created.
- [ ] Three subscriptions: `monthly`, `yearly`, `lifetime`. Display names + descriptions per Brand voice.
- [ ] Localised pricing for ZA + US + (initial markets).
- [ ] Privacy Policy + Terms of Service URLs filled in (App Store review will reject without).
- [ ] Sandbox tester created (Users and Access → Sandbox Testers). Different email from real Apple ID.

### C. Google Play Console (Android)

- [ ] Package `com.everionmind.app` registered.
- [ ] Signed AAB uploaded to **Internal testing** track minimum (subscriptions don't appear in dev builds).
- [ ] Subscriptions: `monthly`, `yearly`, `lifetime` configured + activated.
- [ ] Localised pricing.
- [ ] Tester list (Closed Testing) added — only listed testers can purchase in sandbox.

### D. Vercel env vars

| Var | Value | Where read |
|---|---|---|
| `VITE_REVENUECAT_API_KEY_IOS` | `appl_…` from RC dashboard | `src/lib/revenuecat.ts` (build-time) |
| `VITE_REVENUECAT_API_KEY_ANDROID` | `goog_…` from RC dashboard | `src/lib/revenuecat.ts` (build-time) |
| `REVENUECAT_SECRET_API_KEY` | Secret key from RC dashboard | LemonSqueezy bridge (server) |
| `REVENUECAT_WEBHOOK_AUTH` | Bearer secret you set in dashboard webhook config | `api/user-data.ts:handleRevenueCatWebhook` |
| `REVENUECAT_STARTER_PRODUCT_ID` | RC product identifier for starter tier | webhook handler tier mapping |
| `REVENUECAT_PRO_PRODUCT_ID` | RC product identifier for pro tier | webhook handler tier mapping |
| `REVENUECAT_MAX_PRODUCT_ID` | RC product identifier for max tier | webhook handler tier mapping |

`VITE_*` keys are **build-inlined** — every native build needs them present at `npm run build` time, not at runtime. Setting them in Vercel covers the web bundle; for the Capacitor native build, they need to be present in the local `.env` when running `npm run build && npx cap sync`.

### E. Native build

```bash
npm run build && npx cap sync
npx cap open ios       # Xcode → run on a sandbox-signed device
npx cap open android   # Android Studio → run on internal testing build
```

Sandbox testing only works on a real device, signed with a sandbox tester (iOS) or in a Closed Testing track (Android). The simulator can't transact.

### F. Test flow checklist

- [ ] Install build on sandbox device, sign in to the app with a real Supabase user.
- [ ] Open Settings → Billing → Upgrade.
- [ ] Paywall presents.
- [ ] Purchase a sandbox monthly. Confirm:
  - [ ] Paywall closes.
  - [ ] `useRevenueCatEntitlement().isPro` flips immediately (UI re-renders without refresh).
  - [ ] Within 5s, `user_profiles.tier` updates to `pro` in Supabase (verify via SQL).
  - [ ] Webhook log on Vercel shows `[revenuecat]` event resolved + tier applied.
  - [ ] Cross-device check: open the same account on web — tier shows Pro.
- [ ] Tap Manage Subscription → Customer Center opens with cancel/change-plan options.
- [ ] Force-quit the app, reopen, sign out, sign back in. Confirm tier still Pro (canonical persistence).
- [ ] Restore Purchases on a fresh install with the same Apple ID — entitlement returns.
- [ ] Cancel sandbox subscription. Confirm webhook fires `CANCELLATION` → `tier='free'` after the period ends (sandbox accelerates this — minutes instead of months).

## Edge cases handled in code

| Case | Behaviour |
|---|---|
| Web user opens BillingTab | `isNative()` returns false. RC SDK never initialises. LemonSqueezy flow runs. |
| User signs out on native | `Purchases.logOut()` called. Next user signing in gets a fresh `appUserID`. |
| Purchase mid-flight, app force-quit | RC SDK resumes the receipt validation on next launch. Webhook eventually fires. Optimistic state catches up via `getCustomerInfo()`. |
| Webhook delayed / fails | Optimistic `isPro` already true. Canonical tier eventually catches up. RC retries the webhook with exponential backoff. The hourly cron also reconciles user state. |
| User pays on web, then opens mobile | LS webhook → RC promotional entitlement → next mobile launch sees `isPro=true` via CustomerInfo. |
| User has both web + mobile subs (mistake) | LS webhook drops PROMOTIONAL-store RC events to avoid echo. Manual de-dup via the dashboard if it happens. Note in `Legal/pricing-billing.md`. |
| Missing API key for platform | `configureRevenueCat()` logs a warning and bails. Paywall shows `NOT_PRESENTED` result, surface fallback message in BillingTab. |
| RC backend down | `presentPaywall()` returns `ERROR`. User sees a sonner error. Retry-after-X behaviour comes from RC SDK. |
| Sandbox purchase succeeds but webhook URL wrong | Optimistic state still works locally for the session; canonical tier never updates. Visible in Vercel logs as missing webhook events. Fix dashboard webhook URL. |

## Known gaps / follow-ups

- Paywall trigger from inside a feature gate (e.g. user taps a Pro-only button → paywall). Wiring exists via `useRevenueCatEntitlement().openPaywall()`; needs to be called from each gated component.
- Promo codes: RC supports them but UI not wired. Future: settings → "Redeem code" button calling `Purchases.presentCodeRedemptionSheet()` (iOS only — Android handles in Play Store).
- Family Sharing (iOS only): set per subscription group in App Store Connect. Confirm before launch which subs are shareable.
- Promotional offers (intro / win-back): designed in App Store Connect, surfaced via RC. Not configured yet.
- Sandbox subscription accelerates time (1 month = 5 min). For real-world expiry behaviour, test on a Production-Ready test build with a real Apple ID + a paid sub.
- The audit (`production-2026-05-06.md`, F H1) flagged the LemonSqueezy `successUrl` open-redirect. RevenueCat doesn't have a redirect surface but apply same pattern to any future return URLs.

## Server webhook reference

Endpoint: `POST /api/revenuecat-webhook` (rewrite in `vercel.json` → `/api/user-data?resource=revenuecat-webhook`).

Auth: `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>`. Constant-time comparison, fail-closed.

Idempotency: Upstash `SET NX webhook:revenuecat:event:<id> 1 EX 86400`. Replay returns 200 without re-processing.

Tier mapping (in handler):

| RC entitlement state | `user_profiles.tier` |
|---|---|
| `everion_mind_pro` active, product = `monthly` | `pro` |
| `everion_mind_pro` active, product = `yearly` | `pro` |
| `everion_mind_pro` active, product = `lifetime` | `max` |
| no active entitlement | `free` |

Audit log: every transition writes a row to `audit_log` with `action='tier_change'`, `metadata={ from, to, source: 'revenuecat', event_id }`.

## Glossary

- **AppUserID** — RC's identifier for a user. We set this to Supabase `user.id` so the webhook can resolve the user_profiles row.
- **Entitlement** — RC's abstraction over "user has access to feature X". One entitlement (`everion_mind_pro`) covers all our paid tiers.
- **Offering** — A set of packages presented on the paywall. We have `default`. A/B-test by adding more.
- **Package** — A specific product wrapped in a duration ($rc_monthly, $rc_annual, $rc_lifetime).
- **Customer Center** — RC's hosted "manage subscription" UI. Native, App-Store-compliant, no design work needed.
- **Optimistic state** — Local `isPro` flag that flips before the webhook lands. UX paint-over.
- **Canonical state** — `user_profiles.tier` in Supabase. Source of truth for cross-device.
