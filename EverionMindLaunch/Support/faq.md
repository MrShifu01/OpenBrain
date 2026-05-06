# FAQ

Public-facing FAQ. Lives at `everion.smashburgerbar.co.za/help` (TODO build the page). Source of truth for answers — page rebuilds from this file.

> Append-only. When a support ticket repeats, the answer belongs here.

## What is Evara?

Evara is a private AI memory app. You capture things you want to remember (license expiries, family info, documents, account numbers, passwords, anything) and Evara remembers them, summarises them, and answers your questions about them in plain English.

## Is my data private?

Yes. We default to the strongest privacy setting we can offer:

- **Vault content** is encrypted in your browser before it leaves your device. We literally cannot read it. If you forget your passphrase and lose your recovery key, neither we nor anyone else can recover that content.
- **Non-vault entries** sit in our database and are sent to AI providers (Google Gemini by default) for enrichment and chat. The provider's terms forbid using your data for training. See `/privacy/ai` (also: `Legal/ai-disclosure.md` in the codebase).
- **Other users cannot see your data.** Row-level security at the database level prevents cross-user reads.

You can disable AI enrichment entirely (Settings → AI → Personalisation) or bring your own AI key on Pro/Max tiers if you'd rather not use the managed provider at all.

## How is this different from ChatGPT / Notion / Apple Notes?

- **ChatGPT** doesn't remember you between sessions (yet). Evara is a persistent memory.
- **Notion** is a workspace you go to. Evara is a memory that watches your life admin and answers when asked.
- **Apple Notes** is unstructured. Evara enriches every entry with AI: extracts dates, classifies type, links related entries, makes everything searchable by meaning, not just keyword.

## How does the AI know my information?

You tell it. Capture by:
- Typing into the capture sheet
- Pasting (URLs, emails, long blocks of text)
- Sharing from another app (iOS share sheet, Android share intent)
- Talking (voice → transcribed → captured)
- Connecting Gmail → Evara watches for emails you mark as memorable

For each entry, Evara classifies type, extracts dates, identifies people/places, and makes it semantically searchable. Then when you ask a question, it searches your memory and answers from your own information — with sources cited.

## What about my Gmail / Calendar?

Optional. If you connect Gmail, Evara reads new email metadata (no scanning your full inbox) and surfaces ones you might want to remember — receipts, expiries, invitations, etc. You decide which to keep. You can disconnect at any time and we delete the stored OAuth token.

## What's the pricing?

See `everion.smashburgerbar.co.za/pricing` for current tiers. Summary:
- **Free** — generous limits, single brain, managed AI.
- **Pro** — higher limits, multiple brains, family sharing, BYOK.
- **Max** — high-volume use, business sharing, priority support.

(Specific limits / prices are in `Legal/pricing-billing.md`. Update when launching.)

## Can I share memories with family / a business?

Yes — that's the "Brains" feature. You can create additional brains beyond your personal one and invite people. Each brain has its own member list and role permissions (viewer, editor, admin). Personal-brain content never leaks into shared brains.

## What if I forget my passphrase?

If you have your **recovery key** (the one we showed you at vault setup), you can paste it in the Vault tab → "forgot your passphrase? use recovery key" and unlock. Then you can set a new passphrase.

If you've lost both the passphrase **and** the recovery key, the encrypted content can't be recovered. We don't keep a copy of either. We can wipe your vault setup so you can start over with a new passphrase — your other (non-vault) memories are unaffected. See `Support/account-recovery.md` for the procedure.

## What if I want to delete my account?

Settings → Account → Delete account. Cascades through every user-owned table immediately. By law (POPIA / GDPR) we have to complete this within 30 days; in practice it's instant.

## What about my mobile devices?

Web is live. iOS and Android apps are launching shortly. Native apps add: push notifications, biometric vault unlock, share-sheet capture from any app, offline read.

## What happens if Evara goes away?

You can export everything. Settings → Account → Export downloads a JSON file with every entry, every brain, every metadata field. Vault export includes the encrypted blobs + your recovery key for offline decryption.

## I have a feature request / I found a bug.

The feedback button (in-app, bottom-right) goes straight to Christian. Or email `support@…`. Solo operation right now — first response within 24h, usually faster.

## Who built this?

Christian Stander, solo, in South Africa. Bootstrapped — no external funding. Started 2025, public launch 2026 Q2. See `Brand/press-kit.md` for the full backstory.

## Other questions

If your question isn't here, email `support@…` (TODO real address) or click the in-app feedback button. We'll add common questions to this page over time.

## TODO

- [ ] Build the public `/help` page that renders this file
- [ ] Add screenshots inline (vault setup, brain sharing, capture, chat) once final UI lands
- [ ] Translate to other languages (post-launch)
