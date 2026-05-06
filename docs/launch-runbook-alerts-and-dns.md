# Launch runbook — Sentry alerts & email DNS

Two pre-launch dashboard tasks. Total time: ~15 minutes. Both must be done by a human at the respective web UI — there is no useful CLI/API path because both are tied to your dashboard accounts.

---

## 1) Sentry alert rules (~5 min)

The SDK already captures errors. Without alert rules, no one is paged. You need three rules: error-rate spike, new issue type, slow transaction on the hot endpoints.

### Open the rules page

1. Sign in at <https://sentry.io>.
2. Top-left org switcher → pick the Everion org.
3. Left sidebar → **Alerts**.
4. Top-right → **Create Alert Rule**.

For each of the three rules below: choose the right **type** on the first screen (Issues vs Metric), then pick the Everion project, then paste the conditions.

### Rule A — "Error rate spike" (Metric Alert)

Catches "something broke for many users in a short window." This is the alert that should wake you up.

| Field | Value |
|---|---|
| Type | **Metric Alert** |
| Dataset | Errors |
| Metric | `count(events)` |
| Filter | `event.type:error` |
| Time window | **1 minute** |
| Threshold | **Above 10** events |
| Resolve threshold | Below 2 events for 1 minute |
| Trigger | Critical |
| Action | Email yourself + (optional) Slack channel |
| Name | `🔥 Error spike — >10/min` |

> Why 10/min: at thousands of users, low-single-digit error counts are normal noise (extension scripts, transient network blips). 10/min in a 1-min window is a real incident.

### Rule B — "New issue regression" (Issue Alert)

Fires once per **never-before-seen** issue type. Catches new bug classes the moment they ship.

| Field | Value |
|---|---|
| Type | **Issue Alert** |
| Conditions | A new issue is created |
| Filters | `level: error` AND `environment: production` |
| Frequency | At most **once per issue** |
| Action | Email yourself |
| Name | `🆕 New error type — production` |

### Rule C — Slow API transactions (Metric Alert)

The two endpoints most likely to time out under real load are `/api/llm` and `/api/capture` (capture does AI enrichment inline; llm does retrieval + chat). Vercel Hobby kills at 60s; Pro at 300s. You want to know before it kills.

| Field | Value |
|---|---|
| Type | **Metric Alert** |
| Dataset | Transactions |
| Metric | `p95(transaction.duration)` |
| Filter | `transaction:/api/llm OR transaction:/api/capture` |
| Time window | **5 minutes** |
| Threshold | **Above 30000 ms** (30s) |
| Trigger | Warning |
| Action | Email yourself |
| Name | `🐢 LLM/capture p95 > 30s` |

> If Sentry tracing isn't enabled (you'd see no transaction data), skip Rule C and add it after the first Pro-plan deploy with `tracesSampleRate: 0.1` in `Sentry.init`.

### Verify

Trigger a test error in the production app (open devtools console on the live site, run `Sentry.captureException(new Error('test alert'))`). You should see one event in Sentry within 30s and **no** alert email (because 1 event ≠ spike). Then refresh five times to confirm Rule B fires for new issues if any new ones land.

---

## 2) Email DNS — SPF / DKIM / DMARC for `everion.smashburgerbar.co.za` (~10 min)

Resend sends as `noreply@everion.smashburgerbar.co.za`. Without these records:
- Gmail/Yahoo will mark transactional emails as spam (especially for new domains in 2024+).
- DMARC strict policies elsewhere will outright reject your mail.
- SPF mismatch shows users a "this email may not be from Everion" warning.

### Step 1: Get the records from Resend

You don't write SPF/DKIM by hand for Resend — they generate the exact records, including a DKIM selector and a custom return-path. Don't skip this step or use generic Resend examples from blog posts; the DKIM key is unique to your project.

1. Sign in to <https://resend.com/domains>.
2. Click **Add Domain** if `everion.smashburgerbar.co.za` isn't there yet.
   - Region: pick **eu-west-1** (closest to South Africa) or whichever you originally chose.
3. Resend will display a table of DNS records. Leave this tab open.

You'll see something like:

| Type | Host/Name | Value | TTL |
|---|---|---|---|
| MX | send | feedback-smtp.eu-west-1.amazonses.com | (priority 10) |
| TXT | send | `v=spf1 include:amazonses.com ~all` | |
| TXT | resend._domainkey | `p=MIGfMA0GCSqGSIb3DQEBAQU...` (long key) | |
| TXT | _dmarc | `v=DMARC1; p=none;` | |

(Exact `Host/Name` and `Value` will differ slightly — copy from Resend, don't paste from this doc.)

### Step 2: Add the records at your DNS provider

The zone for `smashburgerbar.co.za` is hosted somewhere — Cloudflare, registrar's DNS, or a custom NS. Find that provider's DNS panel.

For each record from Resend:

- **If your DNS provider's UI uses fully-qualified names**, expand the host: `send` becomes `send.everion.smashburgerbar.co.za`, `resend._domainkey` becomes `resend._domainkey.everion.smashburgerbar.co.za`, `_dmarc` becomes `_dmarc.everion.smashburgerbar.co.za`.
- **If the UI uses relative names within the zone**, use the names as Resend gave them (assuming the zone is `everion.smashburgerbar.co.za` or the parent zone with a subdomain delegation — check by listing existing records and seeing how `@` or the apex is named).
- **If the parent zone is `smashburgerbar.co.za`** (no separate zone for the subdomain), the relative names need to be prefixed with `everion.`. So:
  - `send` → `send.everion`
  - `resend._domainkey` → `resend._domainkey.everion`
  - `_dmarc` → `_dmarc.everion`

For Cloudflare specifically: when entering a TXT record, it auto-strips the zone suffix from the Name field. So entering `send.everion` saves as `send.everion.smashburgerbar.co.za` — correct.

### Step 3: Strengthen DMARC after a soak period

Resend's default `_dmarc` record is `v=DMARC1; p=none;` — this means "monitor only, don't reject anything." That's correct for the first 1–2 weeks: if SPF/DKIM is misconfigured, mail still flows.

After 2 weeks of clean DMARC reports (you can check at <https://postmaster.google.com> by adding the domain), upgrade the record to:

```
v=DMARC1; p=quarantine; rua=mailto:postmaster@smashburgerbar.co.za; pct=100;
```

Then a month later, if reports stay clean, upgrade again:

```
v=DMARC1; p=reject; rua=mailto:postmaster@smashburgerbar.co.za; pct=100;
```

`p=reject` is the gold standard — receiving mail servers will refuse spoofed mail outright. Don't jump straight to `reject` without the soak; one misconfigured record kills 100% of your transactional mail until you fix it.

### Step 4: Verify

1. Back in <https://resend.com/domains> → click the domain → **Verify DNS Records**.
   - DNS propagation is usually <60s but can take up to 48h. If "Pending" after 5 min, recheck record names.
2. Test send: from the Resend dashboard, click **Send Test Email** to your own inbox. Open the message, view headers (Gmail: ⋮ → Show original).
3. Confirm:
   - `SPF: PASS`
   - `DKIM: PASS` with `d=everion.smashburgerbar.co.za`
   - `DMARC: PASS`

If any line says FAIL or NEUTRAL, fix that record and re-test before relying on transactional email at launch.

### Optional but recommended: BIMI

After DMARC is at `quarantine` or `reject` for 30 days, you can add a BIMI record (logo in Gmail/Yahoo inboxes). Out of scope for launch — note for post-launch.

---

## Why this isn't in code

Both setups are tied to dashboard accounts, not source code. Sentry alert rules are stored in Sentry's database; DNS records live at the registrar. There is no useful CLI/API automation that wouldn't require committing your dashboard credentials. So the runbook lives here, gets executed once, and the verification steps prove it stuck.

Once both are done, mark them ✅ in `LAUNCH_CHECKLIST.md` and you're three of four pre-launch HIGHs cleared (the last is Vercel Pro upgrade — a click in <https://vercel.com/dashboard>).
