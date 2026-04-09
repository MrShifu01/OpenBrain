# Future Plans — External Integrations

## Google Workspace (Gmail, Calendar, Drive)

**OAuth 2.0 flow:**
1. User clicks "Connect Google" → redirect to Google's consent screen
2. They approve scopes (read Gmail, read Calendar, etc.)
3. Google returns a refresh token → store encrypted in Supabase `user_ai_settings`
4. Backend uses it to call Google APIs on their behalf

**What to pull in:**
- **Gmail**: recent emails, threads from key contacts, newsletters — summarise and capture as entries
- **Calendar**: upcoming events, recurring meetings — surface as context in chat ("you have a meeting with X tomorrow, here's what you discussed last time")
- **Contacts**: names, emails, relationship history

**Key challenge**: scope creep. Gmail full access is a sensitive scope requiring Google's OAuth verification process (weeks-long review). `gmail.readonly` is easier to get approved.

---

## Phone Contacts

Three realistic paths:

1. **vCard upload** — user exports `.vcf` from phone settings (Settings → Contacts → Export), parse it. Zero OAuth, works today, one-shot.
2. **Google Contacts API** — if they use Google Contacts, same OAuth flow above covers it (`contacts.readonly` scope). Syncs automatically.
3. **iCloud contacts** — Apple has a CardDAV API but poorly documented and requires App Store review for production. vCard export is more practical.

---

## "Deep Dive + Stay Updated" Architecture

Two modes:

**One-time deep dive** — on connect, backfill N months of emails/events into entries with embeddings. Expensive but gives RAG context immediately.

**Ongoing sync** — a cron job (already have `api/cron/`) that polls for changes:
- Gmail: watch API (push webhooks) or poll every 15 min for new threads
- Calendar: push notifications via Google Calendar push API
- New content gets captured and embedded automatically

---

## Practical Starting Point

Lowest-friction path given existing stack:

```
vCard import → parse contacts → capture as "contact" type entries → embedded → searchable in chat
```

No OAuth, no review process, immediate value. Then layer Google OAuth on top once the use case is proven.

---

## Concerns

- **Privacy**: very sensitive data — users need clear visibility into what's stored
- **Token storage**: refresh tokens must be encrypted at rest (not just row-level security)
- **Quota**: Gmail API has generous quotas but Calendar watch notifications expire every 7 days and need renewal
- **Scope approval**: Google's OAuth verification for sensitive scopes (Gmail read) requires a privacy policy, security assessment, and can take 4–6 weeks
