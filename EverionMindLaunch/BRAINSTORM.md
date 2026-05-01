# Everion Mind — Brainstorm & Idea Park

**A living document.** Add new ideas at the bottom of the table and the details section, then re-sort by Priority Score. Killed ideas stay (with a strikethrough) so we remember why we killed them.

---

## Scoring guide

| Column             | What it measures                          | Scale                       |
| ------------------ | ----------------------------------------- | --------------------------- |
| **Usefulness**     | Day-to-day value to users                 | 1–10 (higher = more useful) |
| **Scope Creep**    | Build cost / distance from core purpose   | 1–10 (lower = less creep)   |
| **Wow Factor**     | First impression delight                  | 1–10 (higher = more wow)    |
| **Unique**         | Differentiation from competitors          | 1–10 (higher = more unique) |
| **Priority Score** | `Usefulness + Wow + Unique − Scope Creep` | Higher = build sooner       |

---

## Master table (sorted by Priority Score)

| #   | Idea                             | Useful | Creep | Wow | Unique | Priority | Source     | Status / target window |
| --- | -------------------------------- | ------ | ----- | --- | ------ | -------- | ---------- | ---------------------- |
| 1   | Smart Contradictions             | 8      | 2     | 9   | 9      | **24**   | Brainstorm | Month 6+               |
| 2   | Weekly Reflection Prompt         | 8      | 3     | 9   | 8      | **22**   | Brainstorm | Month 1–2              |
| 3   | Proactive AI Push                | 8      | 4     | 9   | 8      | **21**   | Research   | Month 3–6              |
| 4   | Memory Decay Indicators          | 7      | 3     | 8   | 8      | **20**   | Brainstorm | Month 6+               |
| 5   | On-This-Day Resurfacing          | 8      | 2     | 8   | 5      | **19**   | Research   | Month 1–2              |
| 5   | Conversation Threading           | 8      | 4     | 8   | 7      | **19**   | Brainstorm | Month 6+               |
| 5   | Voice Journaling → Insight       | 8      | 3     | 8   | 6      | **19**   | Brainstorm | Month 3–6              |
| 5   | Daily Brief                      | 8      | 2     | 7   | 6      | **19**   | Brainstorm | Month 1–2              |
| 9   | Resurface This Later             | 9      | 2     | 6   | 4      | **17**   | Brainstorm | Month 1–2              |
| 9   | Home Screen Widget               | 9      | 5     | 8   | 5      | **17**   | Brainstorm | Mobile (Capacitor)     |
| 11  | Full-Content Web Clip Indexing   | 8      | 5     | 7   | 6      | **16**   | Research   | Month 6+               |
| 12  | Capture Anywhere via Share Sheet | 9      | 6     | 8   | 4      | **15**   | Brainstorm | Mobile (Capacitor)     |
| 13  | Memory Timeline                  | 6      | 6     | 8   | 6      | **14**   | Brainstorm | Month 6+               |
| 13  | Personal CRM Layer               | 7      | 6     | 6   | 7      | **14**   | Research   | Month 6+               |
| 13  | The Quiet Export                 | 7      | 2     | 5   | 4      | **14**   | Brainstorm | Month 3–6              |
| 16  | Shared Brain                     | 7      | 8     | 7   | 5      | **11**   | Brainstorm | Month 3–6 (paid only)  |

---

## Idea descriptions

### Smart Contradictions

Everion notices when two entries conflict — "want to eat healthier" from 3 months ago vs "started ordering takeout daily" last week. Surfaces the tension quietly. **A mirror for your own inconsistencies.** Highest unique-score on the board because no competitor does this. Risk: too uncomfortable could feel judgmental — needs careful copy.

### Weekly Reflection Prompt

Once a week, Everion asks one question generated from your own captures: "You've been thinking about leaving your job for 4 months — what's actually stopping you?" Uses your data as context. Feels uncomfortably personal in the best way. **Slot into Month 1–2** alongside the weekly digest — same delivery surface.

### Proactive AI Push — "Your AI Noticed Something"

The AI scans your memory store nightly and pushes a small number of high-value observations:
- "You have 5 notes about starting a business but no action item."
- "You haven't followed up with this contact in 6 months."
- "You've captured this same idea 3 times — maybe it's worth acting on."

Moves Everion from reactive retrieval to genuinely intelligent companion. **The biggest differentiator on this list** but also the most prompt-engineering-sensitive. Build after thumbs feedback (Month 1–2) feeds enough data.

### Memory Decay Indicators

Entries fade visually over time if untouched. A note from 8 months ago gets slightly muted. Forces the user to either revisit it or consciously let it go. Makes the memory feel alive rather than an archive. Low scope, high uniqueness. **Pure UI work** — could ship in a single session once Concept Graph re-introduction at 50+ entries lands.

### On-This-Day Resurfacing

Every day, Everion quietly surfaces what you captured on this date last year, two years ago, three years ago. No action required — just a single card. **Day One proved the emotional hit of this is enormous.** Directly addresses the graveyard problem (capture but never revisit). Slot into Month 1–2 — natural fit for the Brain Feed composition rotation.

### Conversation Threading

Captured 12 things about a topic over 6 months? Everion surfaces them as a thread — a timeline of your thinking on that topic. Not tags, not folders — automatic narrative grouping by AI. Pairs naturally with the Concept Graph (Month 3–6) and Memory Timeline (Month 6+).

### Voice Journaling → Insight

Record a 2-minute voice note at end of day. Everion transcribes it, extracts the key things worth remembering, files them silently. Feels like having a personal assistant. The voice transcription pipeline is already wired (Groq Whisper). What's missing is the **end-of-day prompt** + the **silent extraction-and-file** vs the current "preview-then-save" flow. Slot Month 3–6.

### Daily Brief

Every morning, a single smart digest: reminders due today, ideas captured but never acted on, links saved but never read. Not a notification — a curated moment. **"Here's what past-you wanted present-you to know."** Pairs with the Brain Feed (Week 2) — could ship as the "morning composition" of the rotating feed.

### Resurface This Later

One tap on any entry: remind me about this in 1 week / 1 month / when I'm near [location]. **User-initiated spaced repetition meets personal memory.** The non-location-aware version is small (just a scheduled job). Location-aware needs Capacitor + geofencing (Mobile track).

### Home Screen Widget — Instant Capture

Tap a widget, type or speak, done. Never opens the app. Stores offline, syncs later. **Removes the single biggest friction point in any capture tool.** Capacitor wrap unlocks this. iOS WidgetKit + Android App Widgets.

### Full-Content Web Clip Indexing

When a user saves a link, also save the full text of the page — not just the URL. Users can search the content of articles even if the original page is deleted or paywalled. **Fabric.so does this and it's their most-praised feature.** Implementation: `mercury-parser` or Readability.js extraction at capture time. Bundle cost: ~30 KB.

### Capture Anywhere via Share Sheet

On iOS/Android, share any webpage, tweet, or screenshot directly into Everion from any app. No opening the app, no friction. **The moment users make Everion their default capture target.** Capacitor wrap requirement.

### Memory Timeline

A zoomable visual timeline of everything captured — scroll back through months and years, see clusters of thinking. Less utility, more emotional resonance. **"This is my mind across time."** Higher scope (custom timeline component, virtualization, zoom interactions) so deferred to Month 6+ even though wow is high.

### Personal CRM Layer (Rich Contact Objects)

Evolve the existing contact capture type into a first-class object: relationship type, company, last interaction date, linked notes, follow-up reminder. **No mainstream second-brain app does lightweight personal CRM well.** Everion already has contacts — this is the next layer. Pairs with the Persona Pipeline already in the codebase.

### The Quiet Export

Everything ever captured, beautifully formatted as a single PDF or markdown vault. Users realise they fully own their second brain — **no lock-in anxiety.** Compliance value (GDPR data portability) AND marketing value ("export anytime, no fight"). Ship as part of Month 3–6 polish.

### Shared Brain

Invite one person — partner, business partner, co-founder — into a shared brain. Captured decisions, shared context, joint memory. "Here's what we agreed on the kitchen renovation." **Highest scope creep on this list** because it touches RLS, invite flows, role permissions, audit log. Already on the roadmap as Month 3–6 paid-tier-only feature. Pairs with the multi-brain unhide.

---

## Ideas explicitly killed (with reasons — kept so we don't re-propose them)

None yet. As ideas get killed, log them here with date + reason. Examples of what would land here:

- ~~"Push to a smartwatch app"~~ — killed YYYY-MM-DD: too narrow audience, ship Apple Watch only at Month 12+ if iOS install base supports it
- ~~"Self-hosted version"~~ — killed permanently per `STRATEGY.md` "what NOT to build"

---

## Wild swings worth considering (parking lot)

These are higher-risk, higher-reward ideas not yet scored. Bring up in a brainstorm session before promoting one to the master table.

- **AI conversational agent that drafts responses to your unread messages** (Gmail, WhatsApp, Slack) using your own past communication style — privacy-sensitive, but huge daily-utility lift
- **"Brain transplant"** — import someone else's exported brain (e.g., a mentor's, a deceased loved one's letters) as a queryable secondary memory layer
- **Semantic deduplication on import** — when a user mass-imports from Notion/Obsidian/Bear, AI detects duplicate concepts and merges them with a confirmation diff
- **Time-machine mode** — query your brain "as of" a date in the past ("what did I think about X in March?") — uses temporal embeddings + filters
- **Deathbed export** — encrypted vault + entries package mailed to a designated recipient on a dead-man-switch trigger (no sign-in for 90 days → trigger). Most-private permanent legacy product. Niche but emotionally resonant.
- **Marketplace of "brain templates"** — a "founder brain", "PhD brain", "household-runner brain" with seed prompts + insight templates pre-installed. Different from full marketplace — just templates, no UGC moderation.
- **Voice-first daily walk mode** — phone in pocket, AirPods in, talk to Everion while walking. Voice-only end-to-end (capture + chat + reply via TTS). Activate via shortcut.
- **Email forwarding address** (`me@inbox.everionmind.com`) — forward any email to your brain to capture the thread + attachments. Simpler than Gmail OAuth, hits 80% of the use case.
- **Bulk-paste-anything API endpoint** — paste a 50-page document, AI splits + categorizes + tags + dedupes against existing entries
- **"How would past-me have answered this?"** — chat mode that constrains retrieval to entries before a date the user picks. Useful for revisiting old decisions / writing memoirs / reflective practice.
- **Daily-driver desktop bar app** — macOS menubar / Windows tray, always-on capture textarea, no browser switch needed. Pre-Capacitor desktop wrap.

---

## Lists v2+ deferrals (from spec-lists-v1.md)

Documented but explicitly out of v1 (which ships paste-driven checklists with reorder/edit/delete behind `VITE_FEATURE_LISTS`). These come back when v1 retention/usage data justifies the build cost.

- **File upload import** — Word `.docx`, PDF, Excel `.xlsx`. Existing `fileExtract.ts` covers MD/PDF/Word; Excel needs a new parser. Cost: ~1 day.
- **AI prose split** — paste a paragraph ("here are some movies: Inception, Tenet, Memento") → 3 items. Reuses `/api/llm` with a list-specific prompt. Cost: ~half a day.
- **Per-item embedding** — each list item gets its own vector so cross-list semantic search works ("find me everything about milk"). Trade-off: embedding cost + DB rows scale linearly with item count. Cost: ~1 day + ongoing AI spend.
- **Vault-encrypted lists** — "list of API keys", "list of safe codes". Reuses the AES-256-GCM passphrase derivation; items stored as encrypted blobs in `metadata.items_encrypted`. Cost: ~1 day, doubles the encryption surface.
- **List templates** — "groceries", "packing", "movie night", "meeting agenda". Pre-seeded item lists the user can fork. Cost: ~half a day; but adds maintenance surface (templates rot).
- **Drag-drop reorder** — replaces the v1 ↑↓ buttons. Need either `react-beautiful-dnd` (deprecated) or `@dnd-kit/core` (active). Adds bundle size. Cost: ~half a day.
- **Cross-brain shared lists** — gated by the multi-brain flag. Lists shared across brains a single user owns; useful for couples/teams down the road. Cost: ~1 day; depends on multi-brain phase 2.
- **"Convert item → standalone entry"** — graduate a list item ("watch *Tenet*") to a real entry with full enrichment. Cost: ~half a day.
- **Push notifications** — "your X list has 3 unchecked items, last opened 5 days ago". Needs the broader notifications work first. Cost: ~half a day after notifications layer ships.
- **Recurring lists** — groceries that reset every Sunday, packing list that resets per trip. Cost: ~1 day; needs cron + UI state for "what cycle are we in".

*(Added 2026-05-01 alongside Lists v1 spec.)*

---

## Ops tooling — parking lot (operator-side, not product)

These don't ship to users; they make the solo-founder ops sustainable during launch + beta phase. Don't promote to roadmap unless an actual time-sink shows up.

- **n8n MCP server for launch ops automation.** n8n now exposes workflows as MCP tools (callable from any MCP-aware LLM) and consumes other MCP servers. **Not for the product** — Everion's own MCP is the user-facing surface. Possible owner-side wins: PostHog → daily funnel summary email at 7:30am, beta-feedback inbox routing, Twitter daily-build-in-public scheduling from a Notion backlog. **Bar to set up:** a recurring ops task that takes ≥ 20 min/day for ≥ 30 days AND scripting it directly would take ≥ 4h. Below that bar, a `cron + Resend + 50 lines of TS` is faster and one-less-service-to-host. Re-evaluate day 30 if the morning PostHog walk feels grindy. Don't host n8n before then. *(Added 2026-05-01.)*

---

## How to maintain this file

- **Add an idea?** Append to the end of the master table, fill the scoring columns, write a 2–3 sentence description below.
- **Killed an idea?** Move to the "explicitly killed" section with date + one-line reason. Don't delete — institutional memory matters.
- **Promoted to roadmap?** Update the `Status / target window` column to point at the roadmap horizon ("Month 1–2", "Month 6+", "Mobile track", etc.) — don't remove from this file. The brainstorm is the idea park; the roadmap is what's shipping.
- **Re-score:** every quarter or when major product feedback lands. Priority shifts as the product matures.
