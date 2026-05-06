# Third-party vendor map

Every external service this app talks to. One row per vendor: what it does, where the keys live, who pages, the rate-limit ceiling, and the escape hatch if the vendor goes down.

## Critical path (launch breaks if any goes down)

### Supabase
- **Project**: `wfvoqpdfzkqnenzjxhui` (region: us-east-1 by default)
- **What it does**: Postgres + auth + Realtime + storage. Owns every table.
- **Keys**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server), `VITE_SUPABASE_ANON_KEY` (client)
- **Plan**: Hobby today; upgrade to Pro before launch (see `LAUNCH_CHECKLIST.md`). Hobby has IO-budget caps that already broke us once (see `Working/2026-05-04-db-io-budget-incident.md`).
- **Rate limits**: PostgREST has no built-in cap; bottleneck is connection pooler + IO budget on Hobby.
- **Status page**: <https://status.supabase.com>
- **Escape hatch**: read-only fallback only; no warm secondary. Restore-from-backup is the disaster path (see `Ops/disaster-recovery.md`).

### Vercel
- **Project**: `everion` (12-function Hobby cap — already at 12, see CLAUDE.md)
- **What it does**: hosts the Vite SPA + 12 serverless API functions + redirects
- **Keys**: `VERCEL_*` automatically injected; no app-side keys needed
- **Plan**: Hobby today. Pro upgrade unlocks 12 → 60 functions and removes deployment-protection 401 pre-prod (see `feedback_vercel_protection.md` memory)
- **Rate limits**: 100 GB-Hrs/month (function execution); function timeout 300s (default)
- **Status page**: <https://www.vercel-status.com>
- **Escape hatch**: redeploy from a known-good commit; rollback via dashboard

### Gemini (Google AI)
- **What it does**: primary LLM (chat, enrichment, classification) + embeddings (`gemini-embedding-001`, 768d)
- **Keys**: `GEMINI_API_KEY` (server only)
- **Plan**: free tier today (60 RPM, 1M tokens/day). Paid via Google Cloud once usage exceeds free.
- **Status page**: <https://status.cloud.google.com>
- **Escape hatch**: BYOK Anthropic / OpenAI / OpenRouter for any user with their own key (see `api/_lib/resolveProvider.ts`). Project-wide fallback to `GROQ_API_KEY` if configured.

## Important (degraded experience if down, not a launch blocker)

### Resend
- **What it does**: outbound email (welcome, invite, daily digest, weekly roll-up)
- **Keys**: `RESEND_API_KEY`, `RESEND_FROM`
- **Plan**: starter tier (free up to 100/day, then $20/mo for 50k)
- **Domain**: `noreply@everion.smashburgerbar.co.za`. SPF/DKIM/DMARC tracked in `LAUNCH_CHECKLIST.md`.
- **Status page**: <https://resend-status.com>
- **Escape hatch**: queue-and-retry on 5xx (Resend handles internally). For prolonged outage, disable the cron that emits and apologise the next day.

### LemonSqueezy
- **What it does**: web subscription billing (Starter / Pro / Max)
- **Keys**: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_*_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`
- **Plan**: 5% + $0.50 per transaction (no monthly fee)
- **Status page**: <https://status.lemonsqueezy.com>
- **Escape hatch**: failed checkouts retry client-side; failed webhooks are recoverable via `/api/billing?action=reconcile&user_id=...`

### RevenueCat
- **What it does**: mobile IAP receipt validation (iOS App Store + Google Play)
- **Keys**: `REVENUECAT_SECRET_API_KEY` + `VITE_REVENUECAT_API_KEY_IOS/ANDROID` (public SDK)
- **Plan**: Free up to $10K MTR; 1% above
- **Status page**: <https://status.revenuecat.com>
- **Escape hatch**: receipts cached client-side; webhook retries handled by RC. Manual entitlement grant via RC dashboard if desperate.

### Sentry
- **What it does**: error reporting (client + server)
- **Keys**: `SENTRY_AUTH_TOKEN` (releases) + `VITE_SENTRY_DSN` (client init)
- **Plan**: free dev tier (5k events/month)
- **Escape hatch**: you don't *need* Sentry up to ship. Pause if it ever blocks deploy.

### PostHog
- **What it does**: product analytics + funnels
- **Keys**: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`
- **Plan**: free up to 1M events/month (cloud-eu host)
- **Escape hatch**: client-side only; failures are silent.

## Auth providers

### Google OAuth
- **What it does**: sign-in via Google + Gmail scope (read-only) for Gmail import
- **Keys**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, plus separate `GMAIL_REDIRECT_URI` for Gmail-scope flow
- **Console**: <https://console.cloud.google.com> → APIs & Services → Credentials
- **Escape hatch**: email/password fallback always available

### Microsoft OAuth
- **What it does**: Outlook calendar sync
- **Keys**: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`, `MICROSOFT_TENANT_ID`
- **Console**: <https://entra.microsoft.com> → App registrations
- **Escape hatch**: Google Calendar covers most users.

## Infrastructure

### GitHub
- **What it does**: source repo (`MrShifu01/EverionMind`) + Actions (CI, e2e, Lighthouse, crons)
- **Keys**: `GH_DISPATCH_TOKEN` (app → workflow trigger), repo secrets for workflow runtime
- **Plan**: free
- **Escape hatch**: deploys can run from local CLI if Actions is down (`vercel deploy --prod`).

### Upstash Redis
- **What it does**: rate-limit counter + idempotency reservation store
- **Keys**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Plan**: free up to 10k commands/day
- **Escape hatch**: rate-limit middleware fails open (logs but lets the request through). Idempotency is best-effort — duplicate webhook handling assumes worst-case.

## On-page checklist before launch

- [ ] Every key in `Ops/env-vars.md` is set in Vercel `production` env
- [ ] DNS TXT records (SPF / DKIM / DMARC) verified at <https://resend.com/domains>
- [ ] Supabase project upgraded to Pro (IO budget cap removed)
- [ ] Vercel project upgraded to Pro (function cap raised + production protection removed)
- [ ] LemonSqueezy live mode (not test) for the 3 variant IDs
- [ ] RevenueCat sandbox-tested for both iOS + Android sandboxes
- [ ] Google OAuth app moved out of "testing" mode (consent screen verified by Google)
- [ ] Status pages of all critical-path vendors bookmarked in `Ops/incident-response.md`
