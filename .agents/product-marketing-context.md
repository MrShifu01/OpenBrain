# Product Marketing Context

*Last updated: 2026-04-29*
*Status: V2 — repositioned. Now spans both fleeting thoughts AND high-stakes life facts (vault). Customer-language and proof sections still [PLACEHOLDER] — fill post-launch.*

## Product Overview
**One-liner:** Your second brain — for the thoughts you'd lose and the facts you can't afford to.

**What it does:** Everion is one private place for everything worth remembering. The fleeting stuff (notes, links, voice memos, half-thoughts, PDFs, screenshots) AND the high-stakes stuff (gate codes, policy numbers, ID and bank details, where the spare key is hidden, when the licence renews, what your spouse needs to know if something happens to you). Capture is one tap. Recall is a chat — ask the AI anything and it reads your entries, cites sources, answers in plain language. The encrypted vault holds the things that would hurt to lose.

**Product category:** Personal second brain + private vault. Sits between note-taking apps (Apple Notes, Notion), password managers (1Password, Bitwarden), and AI memory tools (Mem.ai, Reflect). Owns a gap none of them fully cover: *one calm place for both your fleeting thoughts and your life-critical facts, with AI you can ask.*

**Product type:** SaaS web app (PWA-installable, mobile + desktop, offline-first). Single-user with optional shared brain on Pro for a partner / next-of-kin / household.

**Business model:** Freemium SaaS.
- **Hobby (free):** Unlimited entries, local-first, encrypted vault, one brain, BYO AI key.
- **Pro ($6/mo, 14-day trial):** Hosted AI (no key needed), cross-device sync, shared brains with one other person, priority support, export anywhere.

## Target Audience
**Target customers:** Anyone with a life that has paperwork. Three priority segments to *acquire* from, but the product serves a broader household audience once they're in.

1. **Founders** (solo, indie, early-stage) — high context-switching, lots of half-formed thoughts about product/customers/strategy + lots of admin (registrations, tax numbers, supplier details, contractor banking) that lives in fragmented places.
2. **Knowledge workers** (PMs, consultants, strategists, analysts) — meeting notes, research, decisions; PLUS the personal admin layer (insurance renewals, medical aid numbers, gate codes, "what's the password for the alarm panel").
3. **Developers** — code snippets, architecture sketches, debugging notes; PLUS the household-CTO role they often play (managing the family's accounts, devices, serial numbers, warranties).

Underneath these three: **anyone who has ever been the person their family calls when they can't find the policy number.** Skew technical and privacy-aware, but the long tail expands beyond that as the vault story matures.

**Decision-maker:** The end-user themselves. B2C/prosumer. Shared-brain feature opens a household / next-of-kin angle but the buyer is one person.

**Primary use case:** "I need one place for everything that matters — both the thoughts I keep losing and the facts my life runs on." A frictionless capture-and-recall layer that doubles as the vault for the things you'd be stuck without.

**Jobs to be done:**
- **Capture** anything worth keeping in <5 seconds — a thought, a serial number, a gate code, a screenshot of an insurance card — without choosing a folder or filling a form.
- **Recall** by asking in plain language — "when does my driver's licence expire", "what was the policy number for the car", "what did the customer push back on last quarter", "where did I hide the spare key".
- **Hold the high-stakes stuff** — bank details, ID numbers, account numbers, gate codes, medical info, "if something happens to me" notes — encrypted, somewhere I'll actually find them again.
- **Surface connections** I'd never spot manually — three notes from three different weeks turn out to be about the same thing.

**Use cases / scenarios:**
- *Founder:* customer-call insight + supplier banking + tax registration numbers, all askable.
- *Knowledge worker:* meeting decisions + insurance renewals + the alarm panel code.
- *Developer:* architecture decisions + the home Wi-Fi config + every device serial number for warranty claims.
- *Household keeper:* gate codes, medical aid numbers, where deeds and IDs live, "if I die" notes for spouse / executor.
- *Travel:* passport renewal dates, frequent-flyer numbers, "the apartment in Lisbon — door code and host's WhatsApp."
- *Estate / legacy:* a single place a spouse or executor can search if you're not around to answer the question.
- *Personal admin:* policy numbers, account numbers, doctor's contact, vet's contact, the plumber who actually showed up.

## Personas
Mostly B2C single-user, but the vault + shared-brain features open a real household angle.

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| **Primary keeper** (the buyer) | One calm place for everything; never being the person who can't find the thing | Important info scattered across Notes, password manager, paper folders, head, spouse's head | "It's all here. Ask it anything. It's encrypted." |
| **Spouse / household partner** (Pro shared brain) | Knowing they could find the policy number / gate code / "where things are" if needed | "If something happens, I won't know where anything is" | Shared access to the things that matter, without sharing the diary |
| **Future executor / next-of-kin** (downstream beneficiary) | Being able to wind things up without forensic work | "I have no idea what accounts they had" | A single searchable vault the keeper has been maintaining all along |

## Problems & Pain Points
**Core problem:** The things worth remembering — both the *thoughts* you'd lose and the *facts* you can't afford to — live in fifteen different places. Notes app, password manager, email folder, paper file, browser bookmarks, photos, your head, your spouse's head. When you need the policy number / the gate code / the customer insight / the half-formed idea, you can't find it. And if something happens to you, no one else can either.

**Why alternatives fall short:**
- **Notion / Obsidian / Roam:** Demand setup, organization, a system. The blank canvas IS the work. Most people quit during onboarding. Not built for high-stakes encrypted facts.
- **Apple Notes / Google Keep:** Capture is fine. Recall is keyword search. No meaning, no AI. Storing a bank account number in plain Notes feels wrong, because it is.
- **1Password / Bitwarden:** Great for passwords. Built for credentials, not for "the gate code Mom always forgets" or "Dad's medical aid number." Wrong UI for free-form facts and zero help with notes/thoughts.
- **ChatGPT / Claude:** Conversational but stateless. No memory of *your* life. Can't be the place you store anything.
- **Mem.ai / Reflect / similar:** Closer to one half (the notes), but cloud-first with weak privacy posture and no vault story.
- **Spreadsheets / paper folders / "my brain":** The status quo. Works until it doesn't — and the cost of "doesn't" is real (missed renewals, lost thousands, family scrambling).

**What it costs:**
- Time wasted hunting for things you know you wrote down somewhere.
- Money lost to missed renewals, expired warranties, forgotten policies.
- Mental load of being the household's memory because no tool is good enough.
- Real risk: if something happens to the keeper, the household scrambles.

**Emotional tension:** Quiet anxiety that important things are slipping. Frustration that you've tried five tools and none stuck. Distrust that anything cloud-based with bank details is actually private. A guilt-tinged sense that you should have a "system" for this stuff and don't.

## Competitive Landscape
**Direct (same solution, same problem):**
- *Mem.ai* — AI-native notes. Falls short on vault/encryption posture and on holding the high-stakes facts.
- *Reflect* — daily-notes + backlinks + AI. Falls short on capture friction, mobile, and vault.
- *Saner.ai, Heyday, Rewind* — varied AI memory tools. Cloud-first, weak privacy posture, no vault.

**Secondary (different solution, same problem):**
- *Notion / Obsidian / Roam / Logseq* — DIY second brains. The system IS the work; high abandonment. Not built for encrypted high-stakes data.
- *Apple Notes / Google Keep / Bear* — fast capture, weak recall, no AI, no vault-grade encryption.
- *1Password / Bitwarden / Proton Pass* — vault for credentials. Wrong shape for free-form notes, gate codes, "if I die" info, and they don't help you think.
- *ChatGPT / Claude* — magical recall but stateless across sessions; nowhere to actually store the thing.
- *Estate-planning tools (Trustworthy, Everplans):* solve the legacy/vault angle but heavy, formal, and not for daily capture.

**Indirect (different approach to same need):**
- A spreadsheet of important info — falls down on retrieval, mobile capture, and security.
- The folder of important documents — exists, never updated, never findable in a hurry.
- "My partner / parent / spouse remembers" — single point of failure.

## Differentiation
**Key differentiators:**
- **Both halves in one place** — fleeting thoughts AND high-stakes facts in the same encrypted, askable home. No tool currently does both well.
- **One opinionated capture surface** — no folders, no tags required, no template. Type / talk / paste / snap. Works whether it's a poem line or a policy number.
- **Recall by asking** — RAG over your encrypted entries with citations. "When does my driver's licence expire" works. "What did the customer push back on" works.
- **Vault-grade privacy** — local-first, end-to-end encrypted, "nothing leaves your device until you say so." Designed so storing a bank detail feels as safe as storing a thought.
- **BYO AI key on free tier** — uniquely honest free plan; run the whole product on your own Anthropic / OpenAI / OpenRouter / Groq key with no upsell pressure.
- **Shared brain for one other person** (Pro) — the household / next-of-kin angle no other personal-memory tool ships.
- **The Shape** — constellation view of your concepts. Distinctive, brand-defining, competitors don't have it.

**How we do it differently:** The same atomic "entry" holds a half-thought, a PDF, a gate code, or a serial number. One capture pattern, one recall pattern, one privacy guarantee. No mode-switching between "my notes app" and "my vault" and "my AI."

**Why that's better:** You only have to remember one place. The thing you wrote down two years ago is findable by meaning, not by where you filed it. The encrypted vault means the gate code and the bank detail are as safe as the password manager would have stored them — and your spouse can find them without you.

**Why customers choose us:** [HYPOTHESIS — no real user quotes yet] One private place that holds the half-thought *and* the policy number. Quiet, opinionated, honest pricing, no productivity-software guilt. The aesthetic alone is positioning.

## Objections
| Objection | Response |
|-----------|----------|
| "I already use Notion / Apple Notes — why switch?" | Don't have to give them up. Everion is the place for the things that don't fit your work tools — the half-thoughts AND the high-stakes facts (gate codes, policy numbers, "if I die" notes) that don't belong in a wiki or a notes app. The capture-and-vault layer underneath everything else. |
| "I already use 1Password — isn't this redundant?" | 1Password is built for passwords. Everion is for the free-form stuff — gate codes, medical aid numbers, account details, the thing the doctor said, the supplier's banking. Not credentials. Use both. |
| "Is my data really private with bank details and IDs in there?" | Local-first storage, end-to-end encrypted vault, BYO AI key option means your prompts can stay on your key. **[NEEDS: explicit crypto + audit story written up; storing bank details raises the privacy bar to existential — current copy must be backed by real architecture]** |
| "Another AI thing — what's it actually good at?" | One job: reading your own past entries and answering questions about them with citations. Not a general-purpose chatbot. Knows your gate code, not the news. |
| "Why $6/mo when free tools exist?" | Pro buys hosted AI (no key juggling), cross-device sync, and shared brains with one other person — useful for households who want the keeper-and-partner setup. Free tier is genuinely usable forever. |
| "Will this still be here in 2 years?" | Bootstrapped, founder-funded. **Internal note:** ~2 months savings runway as of 2026-04-29 and no public data-portability commitment yet. **Strategic gap is now bigger** — storing bank details and "if I die" info raises the trust bar much higher than for casual notes. Building real export (Markdown + JSON, every entry, every plan) becomes near-mandatory before pushing the vault story. |

**Anti-persona:**
- Power-users who want a fully-customizable knowledge graph (Obsidian/Logseq diehards).
- Teams looking for collaborative wiki/docs (Notion/Confluence territory).
- Anyone who wants a productivity dashboard with metrics and streaks.
- People who want full estate-planning workflows (legal docs, beneficiary forms) — Everion holds the *facts*, not the *legal apparatus*.
- Privacy purists who refuse any cloud-touchpoint (Pro's hosted AI won't work for them; Hobby + BYO key might).

## Switching Dynamics
**Push:**
- "I missed a renewal because I couldn't find the policy number."
- "My notes are everywhere and I can't find anything."
- "If something happened to me, my family wouldn't know where anything is."
- Repeated experience of losing a thought *or* a fact you cared about.

**Pull:**
- Capture in <5 seconds.
- Ask in plain English.
- Encrypted vault for the high-stakes stuff.
- Beautiful, calm aesthetic that doesn't feel like work.
- Privacy posture they can believe.
- Shared brain — the spouse can find the policy number too.

**Habit:**
- Years of muscle memory in Apple Notes / WhatsApp-to-self / Notion / 1Password.
- The notebook on the desk, the folder of policies, the spreadsheet of accounts.
- "Just remembering" or "asking my partner."

**Anxiety:**
- "Is the AI looking at my private bank details?"
- "Is the encryption real?"
- "What if I lose access — is my data trapped?"
- "Do I have to migrate everything from 1Password / Notes?"
- "Will I bounce off it like I did Notion?"

## Customer Language
**How they describe the problem** [PLACEHOLDER — capture verbatim post-launch]:
- *Likely phrases:* "I have notes everywhere", "I keep losing the policy number", "My partner asks me where the gate code is and I can't remember", "If I die my family is in trouble", "I write everything down but can't find anything"

**How they describe Everion** [PLACEHOLDER]:
- *Likely phrases:* "It's where my life lives now", "I just put it all in there", "I asked it about my insurance and it told me"

**Words to use:**
- *room, place, vault, kept, second brain, second memory*
- *the thoughts you'd lose · the facts you can't afford to*
- *capture, recall, hold, ask*
- *private, encrypted, local-first, yours*
- *honest, opinionated, calm*
- *the gate code, the policy number, the renewal date* (concrete examples beat abstractions)
- *brain* (as workspace unit), *vault* (as the encrypted layer)

**Words to avoid:**
- *productivity, organize, system, workflow, tasks, dashboard*
- *knowledge management* (jargon)
- *AI assistant, chatbot* (commodity)
- *note-taking app* (undersells)
- *password manager* (sets wrong frame — we're not credentials)
- *estate planning tool* (sets wrong frame — we're not legal)
- aggressive growth/hustle language

**Glossary:**
| Term | Meaning |
|------|---------|
| Brain | A workspace / vault. One on free, multiple on Pro. Notebook scope. |
| Entry | A single captured item — note, link, voice memo, file, photo, fact. Atomic unit. |
| Vault | Encrypted local store. Where the high-stakes stuff lives. "Nothing leaves your device until you say so." |
| Concept | An auto-extracted theme/topic from an entry. The connective tissue. |
| The Shape | Constellation view of your concepts. Brand pillar. |
| Capture | The one-tap input flow. |
| Recall | Asking your memory a question via chat. |
| Synthesize | Surfaced connections between entries. |
| Shared brain | A brain shared with one other person on Pro. Household / next-of-kin angle. |

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

## Strategic notes (V2 repositioning)
- **Vault story raises the trust bar.** Storing bank details and ID numbers means privacy/encryption claims must be exact and defensible. The objection table flags this.
- **Export commitment becomes near-mandatory.** "Will this still be here in 2 years" is now louder, not quieter. Ship Markdown + JSON export ASAP.
- **Two acquisition angles to test:** (a) "the calm second brain for thinkers" — current voice; (b) "one private place for everything that matters" — vault-led. Likely the second resonates with a broader audience but the first matches existing brand. Test both.
- **Shared brain feature opens estate / household angle.** Don't oversell yet — it's one feature, not a workflow — but the framing exists.
- **Anti-persona expanded.** Estate-planning tool buyers and absolute privacy purists are not the target.
