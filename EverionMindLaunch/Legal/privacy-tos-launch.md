# Privacy policy + Terms of Service — launch checklist

What needs to be on the public legal pages BEFORE launch, and what needs lawyer review.

> **Stub** — fill the TODO sections after legal review. Don't ship public launch without these pages live and reachable.

## Pages required

| Page | URL | Status |
|---|---|---|
| Privacy policy | `/privacy` | TODO |
| Terms of Service | `/terms` | TODO |
| Cookie policy | `/cookies` (or section in Privacy) | TODO |
| AI data disclosure | `/privacy/ai` | Source content in `Legal/ai-disclosure.md` ✅ |
| Refund policy | `/refund` (or section in ToS) | Source in `Legal/pricing-billing.md` |
| Acceptable Use Policy | `/aup` (or section in ToS) | Source in `Support/abuse-moderation.md` |

All of these must be:
- Linked from the footer of every page
- Linked from signup screen
- Reachable BEFORE the user creates an account

## Privacy policy — required content

### Who we are
- Operator: Christian Stander (sole proprietor) → `(Pty) Ltd` if registered before launch
- Address: TODO (legal mailing address; required for POPIA + GDPR contact)
- Email: `privacy@…` (TODO)

### What data we collect
- Account data: email, password hash (Supabase), display name (optional)
- Profile data: persona core (preferred name, pronouns, family info you choose to share)
- Memory entries: title, content, type, tags, dates, metadata
- Vault data: client-side encrypted blobs (we have ciphertext only)
- Connected services data: when you connect Gmail/Calendar, OAuth tokens (encrypted at rest) + the data fetched from them
- Device data: device ID for push notifications (if enabled)
- Usage data: analytics events (page views, button clicks) — see `Analytics/event-taxonomy.md`
- Logs: HTTP server logs, error reports

### Why we collect each thing
For each category above, explain the purpose. (Account → identification. Memory → the product. Logs → debugging + abuse detection.)

### Who we share with
- **AI providers** — Google Gemini by default; OpenAI / Anthropic / OpenRouter if user opts into BYOK. See `/privacy/ai`.
- **Email provider** — Resend, for transactional emails.
- **Hosting** — Vercel (compute), Supabase (database).
- **Analytics** — PostHog.
- **Error tracking** — Sentry.
- **Billing** — LemonSqueezy (web), RevenueCat (mobile).
- **Push** — Firebase (Android), APNs (iOS).
- **Court order / legal process** — only when required by valid legal process.

NEVER share for:
- Advertising
- Selling to data brokers
- Training third-party AI models without your consent

### Where data is stored
- Database: Supabase eu-west region (TODO: verify)
- Hosting: Vercel global
- AI processing: per provider (Gemini = US; OpenAI / Anthropic = US; OpenRouter = various)

### How long
- Active account data: as long as your account exists.
- Deleted account data: purged within 30 days (POPIA + GDPR).
- Logs: 90 days.
- Backups: 30 days (Supabase PITR).
- Anonymous analytics: 365 days.

### Your rights (POPIA + GDPR)
- Right to access: data export available in Settings → Account → Export
- Right to correct: edit any field in-app
- Right to delete: Settings → Account → Delete (cascades immediately)
- Right to portability: export above is machine-readable JSON
- Right to object: turn off enrichment in Settings → AI; close account
- Right to lodge a complaint: Information Regulator of South Africa (POPIA), or your local DPA (GDPR)

### Children
We don't knowingly collect data from children under 16. If we discover an under-16 account, we delete it.

### Changes to this policy
We'll email you at least 14 days before any material change. Version history at TODO public URL.

### Contact
- Privacy questions: `privacy@…`
- DPA: TODO if needed for EU presence

## Terms of Service — required content

### Acceptance
By creating an account, you agree to these terms.

### Service description
- What Evara does (per `Brand/press-kit.md` one-paragraph description)
- That AI responses are not guaranteed accurate; you should verify anything important
- That we run on commodity AI providers and quality may vary

### Account
- Eligibility: 16+ (lower bar than 18 in some jurisdictions; align with privacy policy)
- One account per person (note: family-shared brains are fine, but each person needs their own login)
- You're responsible for keeping your password and passphrase secure
- You're responsible for the content you store

### Acceptable use
- See `Support/abuse-moderation.md` for the full list of prohibited content/behaviour
- We may suspend or terminate for violations

### Pricing & billing
- Tiers and prices per the pricing page
- Auto-renewal; cancel any time
- Refund policy: 7 days self-serve on web; platform-managed on iOS/Android

### IP
- You own your content
- We don't claim any rights to your memories beyond what's needed to operate the service
- We retain rights to the Evara brand, trademarks, code

### Liability
- Service provided "as is"
- We're not liable for data loss in your vault if you lose passphrase + recovery key (we literally cannot recover it)
- Maximum liability capped at fees paid in the past 12 months

### Termination
- You can delete your account any time
- We can terminate for ToS violation; we'll explain why unless legally prohibited

### Governing law
- South African law (Vereeniging, Gauteng)
- Disputes via SA courts unless EU consumer rights override

### Changes
- 14 days notice before material change

## Cookies & tracking

We use:
- **Strictly necessary** — auth session cookie
- **Functional** — remember your sign-in
- **Analytics** — PostHog (anonymous; opt-out available)

We don't use:
- Advertising trackers
- Cross-site tracking pixels
- Third-party social-login pixels (Google sign-in is OAuth only, not analytics-pixel-based)

Cookie banner — required for EU visitors. Show consent banner; default = analytics-off until accepted.

## Drafting checklist

- [ ] Find a SA-based + EU-savvy lawyer (or use a vetted template like Termly/Iubenda for a $0–500 first pass, then have lawyer review)
- [ ] Privacy policy draft → lawyer review → publish
- [ ] ToS draft → lawyer review → publish
- [ ] Cookie banner working (no analytics until accepted)
- [ ] Privacy policy linked from signup (not just footer)
- [ ] All claims about encryption/deletion match what code actually does (this is the #1 source of legal trouble: writing the policy aspirationally and not delivering)
- [ ] Email addresses (`privacy@`, `support@`, `abuse@`, `appeals@`) all forward to a real inbox
- [ ] Version-control the policy pages (audit trail of changes)
- [ ] Update if anything in `Legal/ai-disclosure.md` changes

## TODO before launch

- [ ] Lock final brand name + legal entity
- [ ] Get lawyer review (estimate $500–2000 USD)
- [ ] Publish all pages
- [ ] Email out to early users about the policies
- [ ] Build versioning system for legal pages
- [ ] Add a "policy changes" entry in `audit_log` whenever they update

## References

- `Legal/ai-disclosure.md` — what specifically goes to AI vendors
- `Legal/pricing-billing.md` — pricing + refund details
- `Support/abuse-moderation.md` — AUP enforcement
- `architecture/security.md` — actual technical implementation that policy must match
- POPIA full text: <https://popia.co.za>
- GDPR full text: <https://gdpr.eu>
