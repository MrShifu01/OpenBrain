# Product Marketing Context

*Last updated: 2026-04-30*
*Status: V3 — vault narrowed to true secrets (passwords, credit cards, recovery codes, PINs); admin facts (licence expiry, policy numbers, gate codes) live as regular entries that can be promoted to Important Memories. Customer-language and proof sections still [PLACEHOLDER] — fill post-launch.*

## Product Overview
**One-liner:** Your second brain — what you wrote down, what Everion remembers, and the secrets you keep locked away.

**What it does:** Everion is one private place for everything worth remembering. Capture anything in under five seconds — text, voice, paste, photo, PDF. Ask Everion anything in plain language and it reads your past entries, cites them, and answers. Mark a fact as an **Important Memory** and Everion will always trust it. Lock real secrets — passwords, credit cards, recovery codes, PINs — in the **encrypted Vault**, where the server can't read them.

**Product category:** Personal second brain. Sits next to note-taking apps (Apple Notes, Notion), AI memory tools (Mem.ai, Reflect), and password managers (1Password, Bitwarden). Owns a quiet gap: *one calm place to capture, ask, and keep — with a vault for the few things that have to stay locked.*

**Product type:** SaaS web app (PWA-installable, mobile + desktop, offline-first). Single-user with optional shared brain on Pro for a partner / next-of-kin / household.

**Business model:** Freemium SaaS — three tiers reflecting actual product (V3 reconciled with `BillingTab.tsx`).
- **Hobby (free):** Unlimited entries, local-first, encrypted vault for passwords/cards/PINs, Important Memories, one brain. **BYO AI key** (Anthropic, OpenAI, OpenRouter, Groq) — required for chat/recall on this tier.
- **Starter ($4.99/mo):** Hosted AI included (Gemini Flash), 500 captures + 200 chats per month, cross-device sync. Buys you out of key juggling without committing to Pro.
- **Pro ($9.99/mo):** Premium AI (Claude Sonnet), 2,000 captures + 1,000 chats per month, shared brain with one other person, all features included.

*No free trial currently — the marketing surface previously promised "14-day trial" but Stripe checkout has no `trial_period_days` configured; that promise is removed until the trial is wired up.*

## Target Audience
**Target customers:** Anyone with a life worth remembering. Three priority segments to *acquire* from.

1. **Founders** (solo, indie, early-stage) — high context-switching, lots of half-formed thoughts about product/customers/strategy + lots of decisions and customer insights that go missing.
2. **Knowledge workers** (PMs, consultants, strategists, analysts) — meeting notes, research, decisions; want recall by meaning, not folder.
3. **Developers** — code snippets, architecture sketches, debugging notes, configs.

Skew technical and privacy-aware. The vault is for true secrets (passwords, cards, PINs); regular admin facts (licence expiry, policy numbers, the gate code) live as normal entries you can promote to Important Memories.

**Decision-maker:** The end-user themselves. B2C/prosumer. Shared-brain feature opens a household angle but the buyer is one person.

**Primary use case:** "I need one place for everything I keep losing — and a vault for the few things that have to stay locked." A frictionless capture-and-recall layer with a small encrypted vault for true secrets.

**Jobs to be done:**
- **Capture** anything worth keeping in <5 seconds — a thought, a link, a voice memo, a PDF, a photo — without choosing a folder or filling a form.
- **Recall** by asking in plain language — "what did the customer push back on last quarter", "what was that book recommendation", "when does my licence expire" (if I've kept the entry).
- **Keep** the facts Everion should always trust — Important Memories the user has explicitly approved.
- **Lock** the few things that must stay secret — passwords, credit cards, recovery codes, PINs — in the encrypted Vault the server can't read.
- **Surface connections** I'd never spot manually — three notes from three different weeks turn out to be about the same thing.

**Use cases / scenarios:**
- *Founder:* customer-call insights, decisions, half-thoughts → ask "what did Acme say about pricing?"
- *Knowledge worker:* meeting notes, research, decisions → ask "what did we decide about the 2024 review?"
- *Developer:* architecture sketches, debugging notes, configs → ask "how did I solve that auth bug last March?"
- *Personal admin:* keep important dates (licence expiry, insurance renewal) as regular entries; promote them to Important Memories so Everion answers reliably when asked.
- *Vault:* the password for the alarm panel, credit card numbers, recovery seed phrase, the gate code if you want it locked. Encrypted on your device with a passphrase only you know.

## Personas
Mostly B2C single-user, with a household angle on Pro via shared brain.

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| **Primary keeper** (the buyer) | One calm place for thoughts and facts; recall by meaning; small encrypted vault for true secrets | Notes scattered across apps; can't find what they wrote down | "Capture once. Ask it anything. The few real secrets are encrypted." |
| **Spouse / household partner** (Pro shared brain) | Sharing context and knowledge with one other person | "If something happens, I won't know what they were working on" | Shared access to a chosen brain — without sharing the diary |

## Problems & Pain Points
**Core problem:** The things worth remembering live in fifteen different places. Notes app, browser bookmarks, photos, paper, your head. When you need the customer insight, the half-formed idea, or that book recommendation from three months ago, you can't find it. Search is keyword-only and stateless. Conventional notes apps capture fine but recall poorly. AI chatbots are smart but stateless across sessions. And the few real secrets — passwords, recovery codes, card numbers — sit in yet another tool.

**Why alternatives fall short:**
- **Notion / Obsidian / Roam:** Demand setup, organization, a system. The blank canvas IS the work. Most people quit during onboarding.
- **Apple Notes / Google Keep:** Capture is fine. Recall is keyword search. No meaning, no AI.
- **1Password / Bitwarden:** Great for credentials, but only credentials. Wrong shape for free-form notes and zero help with thoughts.
- **ChatGPT / Claude:** Conversational but stateless. No memory of *your* life. Can't be the place you store anything.
- **Mem.ai / Reflect / similar:** Closer to one half (notes + AI), but cloud-first with weak privacy posture and no encrypted vault for true secrets.

**What it costs:**
- Time wasted hunting for things you know you wrote down somewhere.
- Decisions and customer insights that decay because nobody finds them again.
- Mental load of being your own filing system across five apps.

**Emotional tension:** Quiet anxiety that important things are slipping. Frustration that you've tried five tools and none stuck. A guilt-tinged sense that you should have a "system" for this stuff and don't.

## Competitive Landscape
**Direct (same solution, same problem):**
- *Mem.ai* — AI-native notes. Cloud-first; weak privacy posture; no encrypted vault for true secrets.
- *Reflect* — daily-notes + backlinks + AI. Falls short on capture friction and mobile.
- *Saner.ai, Heyday, Rewind* — varied AI memory tools. Cloud-first, weak privacy posture.

**Secondary (different solution, same problem):**
- *Notion / Obsidian / Roam / Logseq* — DIY second brains. The system IS the work; high abandonment.
- *Apple Notes / Google Keep / Bear* — fast capture, weak recall, no AI.
- *1Password / Bitwarden / Proton Pass* — vault for credentials only. Don't help you think or remember.
- *ChatGPT / Claude* — magical recall but stateless across sessions; nowhere to actually store the thing.

**Indirect (different approach to same need):**
- A spreadsheet — falls down on retrieval, mobile capture.
- The folder of important documents — exists, never findable in a hurry.

## Differentiation
**Key differentiators:**
- **Capture, ask, keep, lock — in one app.** Capture as raw entries; ask Everion across them; mark the few facts Everion should always trust as Important Memories; keep true secrets locked in the encrypted Vault. One product, four jobs.
- **One opinionated capture surface** — no folders, no tags required, no template. Type / talk / paste / snap.
- **Recall by asking** — RAG over your past entries with citations. "What did Acme push back on" works.
- **Important Memories** — user-approved durable facts Everion always trusts. Not AI-inferred; you decide what's authoritative.
- **Encrypted Vault for true secrets** — passwords, credit cards, recovery codes, PINs. Local-first, end-to-end encrypted with a passphrase only you know. The server can't read it.
- **BYO AI key on free tier** — uniquely honest free plan; run the whole product on your own key with no upsell pressure.
- **The Shape** — constellation view of your concepts. Brand-defining, competitors don't have it.

**How we do it differently:** Notes and AI memory in one tool, with a small encrypted vault next to it for the few things that have to stay locked. Most second-brain apps either skip the vault or skip the AI; password managers do neither.

**Why that's better:** You only need one place for everything except your active credentials. The thing you wrote down two years ago is findable by meaning. The few real secrets are encrypted on your device, not in a "private notes" lie.

**Why customers choose us:** [HYPOTHESIS — no real user quotes yet] A quiet, literary memory app with honest pricing, real encryption for the secrets that matter, and AI you control. No productivity-software guilt.

## Objections
| Objection | Response |
|-----------|----------|
| "I already use Notion / Apple Notes — why switch?" | Don't have to give them up. Everion is the place for the things that *fall through* your work tools — half-thoughts, voice memos, decisions, customer insights — and lets you ask across them. Plus a small encrypted vault for credentials. |
| "I already use 1Password — isn't this redundant?" | 1Password is for credentials. Everion's vault holds whatever you choose to lock — passwords if you don't have a manager, but more usefully: recovery codes, card numbers, PINs, anything you want kept off the server. The bigger product is the notes + AI, not the vault. |
| "Is the encryption real?" | Vault entries are end-to-end encrypted on your device with AES-GCM 256, key derived via PBKDF2 (310k iterations). Your passphrase never leaves the browser. We can't decrypt vault content even if forced. Regular entries (notes, links, voice memos) are stored in our DB to enable search and AI — that's the trade. |
| "Another AI thing — what's it actually good at?" | One job: reading your past entries and answering questions about them with citations. Not a general-purpose chatbot. |
| "Why $4.99 / $9.99 when free tools exist?" | Paid tiers buy hosted AI (no key juggling), cross-device sync, larger limits, and shared brain on Pro. Free tier with BYO key is genuinely usable forever. |
| "Will this still be here in 2 years?" | Bootstrapped, founder-funded. ~2 months savings runway as of 2026-04-29. Full data export (JSON + CSV) is shipped — your data is yours regardless. |

**Anti-persona:**
- Power-users who want a fully-customizable knowledge graph (Obsidian/Logseq diehards).
- Teams looking for collaborative wiki/docs (Notion/Confluence territory).
- Anyone who wants a productivity dashboard with metrics and streaks.
- People who want full estate-planning workflows (legal docs, beneficiary forms) — Everion holds the *facts*, not the *legal apparatus*.
- Privacy purists who refuse any cloud-touchpoint (Pro's hosted AI won't work for them; Hobby + BYO key might).

## Switching Dynamics
**Push:**
- "My notes are everywhere and I can't find anything."
- "I keep losing decisions and customer insights."
- "I want to ask my notes a question, not search through them."
- Frustration with stateless AI chats — nothing carries between sessions.

**Pull:**
- Capture in <5 seconds.
- Ask in plain English.
- Important Memories — facts Everion always trusts.
- Encrypted vault for the few real secrets.
- Beautiful, calm aesthetic that doesn't feel like work.
- Privacy posture they can believe.

**Habit:**
- Years of muscle memory in Apple Notes / WhatsApp-to-self / Notion.
- The notebook on the desk, the spreadsheet of accounts.
- "Just remembering" or "searching ChatGPT history."

**Anxiety:**
- "Is the AI reading my private notes?"
- "Is the encryption real?"
- "What if I lose access — is my data trapped?"
- "Will I bounce off it like I did Notion?"

## Customer Language
**How they describe the problem** [PLACEHOLDER — capture verbatim post-launch]:
- *Likely phrases:* "I have notes everywhere", "I want to ask my notes", "I keep losing decisions", "I write everything down but can't find anything"

**How they describe Everion** [PLACEHOLDER]:
- *Likely phrases:* "It's where my thinking lives", "I just put it all in there", "I asked it and it told me"

**Words to use:**
- *room, place, kept, second brain, second memory*
- *capture, recall, hold, ask*
- *private, encrypted, local-first, yours*
- *honest, opinionated, calm*
- *brain* (as workspace unit), *vault* (the encrypted layer for true secrets), *Important Memory* (user-approved durable fact)

**Words to avoid:**
- *productivity, organize, system, workflow, tasks, dashboard*
- *knowledge management* (jargon)
- *AI assistant, chatbot* (commodity)
- *note-taking app* (undersells)
- *password manager* (sets wrong frame — vault is for whatever you choose, not just credentials)
- *estate planning tool* (sets wrong frame — we're not legal)
- aggressive growth/hustle language

**Glossary:**
| Term | Meaning |
|------|---------|
| Brain | A workspace. One on free, multiple on Pro. Notebook scope. |
| Entry | A single captured item — note, link, voice memo, file, photo. Atomic unit. |
| Important Memory | A user-approved durable fact Everion will always trust. |
| Vault | Encrypted local store for true secrets — passwords, credit cards, recovery codes, PINs. AES-GCM 256, key derived from your passphrase via PBKDF2-310k. The server can't read it. |
| Concept | An auto-extracted theme/topic from an entry. The connective tissue. |
| The Shape | Constellation view of your concepts. Brand pillar. |
| Capture | The one-tap input flow. |
| Recall | Asking your memory a question via chat. |
| Synthesize | Surfaced connections between entries. |
| Shared brain | A brain shared with one other person on Pro. |

## Brand Voice
**Tone:** Quiet, literary, considered. Confident without being loud. Warm without being twee. The literary register works for high-stakes/emotional material (estate planning, "if I die" info) better than a utility tone — keep it.

**Style:** Lowercase fragments mixed with proper sentences. Serif typography (Newsreader, Source Serif, Fraunces). Italics for emotion. Specific concrete details ("where I hid the spare key", "the gate code Mom always forgets") over abstract claims ("important info").

**Personality:** Thoughtful · private · opinionated · calm · crafted

## Proof Points
**Metrics:** [PLACEHOLDER — instrument before launch]

**Customers:** [PLACEHOLDER — early adopter logos / personas]

**Testimonials:** [PLACEHOLDER — collect from beta]

**Value themes:**
| Theme | Proof |
|-------|-------|
| Both halves in one place | The same entry pattern holds a half-thought OR a policy number; same capture, same recall, same privacy |
| Frictionless capture | One-tap on desktop, thumb-once on mobile, text/voice/paste/file/photo, no title required |
| Vault-grade privacy | Local-first, end-to-end encrypted, BYO AI key option, **[needs: export-anywhere commitment]** |
| Memory you can ask | RAG over your entries with citations — "when does my licence expire", "what did the customer say last quarter" |
| Connections you didn't see | Auto-surfaced concept links, the Shape constellation view |
| Honest pricing | Free tier is genuinely free and usable forever; Pro is $6/mo with no dark patterns |
| Shared with one person | Pro shared brain — spouse / partner / next-of-kin can find what they need |

## Goals
**Business goal:** Soft public launch — no hard signup or revenue target. Read the market across two angles (fleeting-thoughts buyer vs. vault buyer), find which converts strongest, double down. **Implicit constraint:** ~2 months runway means revenue traction matters more than vanity signups; lean Pro conversion.

**Conversion action:** Sign up (CTA: "Start remembering" / "Start free" / "Start 14-day trial").

**Current metrics:** [PLACEHOLDER — instrument signups, time-to-first-capture, time-to-first-vault-entry, D7 retention, free→Pro rate before launch]

## Strategic notes (V3 — vault narrowed)
- **Vault scope narrowed to true secrets.** Passwords, credit cards, recovery codes, PINs — not "anything sensitive". Admin facts (licence expiry, gate codes, policy numbers) live as regular entries, promotable to Important Memories. Cleaner story, easier to defend cryptographically, less competitive overlap with notes apps.
- **Important Memories is the new third pillar.** Capture / recall / **keep** / lock. User-curated only in v0 (no AI inference, no contradiction detection — those are post-launch). Full plan in `LAUNCH_CHECKLIST.md` post-launch section.
- **Encryption claims must stay exact.** AES-GCM 256, PBKDF2 310k iterations, key derived from passphrase, server can't decrypt. Don't inflate; don't hedge.
- **Acquisition angle: capture-and-recall first, vault as feature.** V2's "vault for everything that matters" tested too broad — narrowed to "second brain with a small encrypted vault for the few real secrets." Less ambitious framing, more defensible.
- **Shared brain stays as Pro feature.** Don't lead with estate-planning angle; mention as use-case footnote at most.
- **Anti-persona unchanged.** Estate-planning workflow buyers, knowledge-graph diehards, privacy purists with no cloud tolerance.
