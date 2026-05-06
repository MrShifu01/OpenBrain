# Everion Mind — Market & Competitive Research

**Last updated:** April 2026

The competitive landscape, what users praise, what they complain about, and where Everion's openings are.

---

## Competitive positioning matrix

| App                 | Paid entry   | Android       | AI retrieval     | E2E encryption      | Free tier         |
| ------------------- | ------------ | ------------- | ---------------- | ------------------- | ----------------- |
| **Everion Mind**    | TBD          | Yes (web/PWA) | Yes (chat)       | Yes (secrets vault) | TBD               |
| Mem.ai              | $12/mo       | **No**        | Yes              | No                  | 25 notes/mo       |
| Obsidian            | $4/mo (sync) | Yes (buggy)   | Plugins only     | No (local only)     | Yes (full)        |
| Notion AI           | $15/user/mo  | Yes           | Yes              | No                  | Limited trial     |
| Readwise Reader     | $9.99/mo     | Yes           | Partial          | No                  | 30-day trial      |
| Reflect             | $10/mo       | Yes           | Limited          | Yes                 | **No free tier**  |
| Capacities          | $9.99/mo     | Yes (buggy)   | Yes              | No                  | Yes               |
| Fabric.so           | $6/mo        | Yes           | Yes              | No                  | Yes (limited)     |
| Day One             | $49.99/yr    | Yes           | Limited          | Yes                 | Yes (basic)       |
| Anytype             | $5/mo        | Yes           | Limited          | Yes                 | Yes (generous)    |
| Tana                | $10/mo       | Partial       | Yes              | No                  | Free beta         |
| Supernotes          | $8.08/mo     | Yes           | Shallow          | No                  | 100 cards         |
| Personal.ai         | $40/mo       | Yes           | Yes (PLM)        | No                  | No                |
| **CortexOS**        | $9.99/mo     | Yes           | On-device only   | Yes (AES-256-GCM)   | 50 entries/mo     |
| **Cortex (Poudel)** | Free         | **No** (iOS+) | On-device only   | Implied (on-device) | Free              |
| **Everloom.app**    | TBD (waitlist) | TBD         | TBD              | TBD                 | TBD               |
| **Everkeep**        | ~$5/mo (USD eq.) | **No** (iOS+) | None (no AI)   | Not disclosed       | Free + IAP        |

---

## App breakdowns

### Mem.ai

- **Pricing:** Free (25 notes + 25 AI chats/mo) · Pro $12/mo
- **Platform:** Web, macOS, iOS — **no Android**
- **Differentiator:** AI-organized with zero manual structure — no folders, no tags. Mem Chat queries the entire library conversationally. Mem 2.0 (Oct 2025) added offline + smarter voice capture.
- **Weaknesses:** No Android. Missing basic features (no text highlighting, scroll bugs). Unreliable search. Poor support. High price for rough edges.
- **Notable:** Auto-linking of notes without manual input — entirely model-driven organization.

### Rewind AI / Limitless (Meta-acquired — effectively defunct)

- **Pricing was:** $99 hardware + $20/mo. Post-Meta (Dec 2025): free for 1 year, then folded into Meta ecosystem.
- **Platform was:** macOS + iOS/Android companion + hardware pendant. Now defunct as standalone.
- **Differentiator:** Ambient total-recall — Pendant recorded all in-person conversations; desktop app recorded every meeting, screen, and audio. Full timeline queryable by AI ("what happened last Tuesday at 3pm?").
- **Weaknesses:** Product is dead. Privacy backlash at Meta acquisition was immediate.
- **Notable:** Proved massive consumer demand for ambient/passive capture. **Space is now wide open.**

### Notion AI

- **Pricing:** Free (limited trial) · Plus $10/user/mo · **Business $15/user/mo (full AI)** · Enterprise custom
- **Platform:** Web, iOS, Android, macOS, Windows
- **Differentiator:** Workspace + relational databases + AI Agents (Sept 2025). Agents can autonomously work across hundreds of pages for up to 20 minutes. Cross-model: GPT-4.1 + Claude 3.7 Sonnet.
- **Weaknesses:** Full AI now requires $15/user Business plan (May 2025 change, **major backlash**). Performance degrades with large workspaces. Not a personal memory tool — requires manual structure.
- **Notable:** AI Agents that operate autonomously across an entire workspace — most capable non-chat AI feature in the category.

### Obsidian

- **Pricing:** Free for personal · Sync $4/mo · Publish $8/mo
- **Platform:** Windows, macOS, Linux, iOS, Android (buggy on Android — loading exceeds 1 minute)
- **Differentiator:** Local-first Markdown vault, 1,400+ plugins. AI via plugins (Smart Connections, Smart Composer) including local models via Ollama — zero cloud dependency.
- **Weaknesses:** Android sync broken/unreliable. **High setup friction** (users spend hours on config). No native AI — requires plugin setup. No collaboration.
- **Notable:** Dataview plugin turns vault into a queryable database (SQL over Markdown). True data portability — plain files readable by any editor forever.

### Readwise Reader

- **Pricing:** Free 30-day trial · Lite $5.59/mo · Full $9.99/mo (annual)
- **Platform:** Web, iOS, Android, browser extension
- **Differentiator:** Unified read-later inbox for every format (articles, PDFs, EPUBs, newsletters, RSS, YouTube, Twitter threads). "Ghostreader" AI reads alongside you. Spaced-repetition resurfacing of highlights to Obsidian, Notion, Roam.
- **Weaknesses:** iOS home screen lag ("basically unusable"). No PDF/print export. No bulk mobile actions.
- **Notable:** **Native spaced-repetition resurfacing as a core product feature** — not a plugin, not an add-on.

### Reflect.app

- **Pricing:** No free tier (14-day trial only) · $10/mo or $100/yr
- **Platform:** Web, iOS, Android, macOS
- **Differentiator:** Speed — consistently rated the fastest note-taking UX. Auto-backlinks, built-in GPT-4, calendar integration (notes auto-linked to meetings). End-to-end encrypted by default.
- **Weaknesses:** **No free tier is #1 complaint.** Not suited for databases/projects. Graph view tangles at scale.
- **Notable:** Contextual resurface while writing — surfaces past notes relevant to what you're typing, in real time.

### Capacities

- **Pricing:** Free (unlimited notes, 5 GB) · Pro $9.99/mo · Believer $12.49/mo
- **Platform:** Web, desktop, iOS, Android (buggy — words disappear randomly)
- **Differentiator:** Typed object model. Every item is a typed object (Book, Person, Project, Event) with structured properties. Creates a typed personal knowledge graph.
- **Weaknesses:** Android is bafflingly poor. No bulk import. Steep learning curve. No collaboration.
- **Notable:** Daily notes + typed object graph combo — journaling that auto-links to structured objects.

### Fabric.so

- **Pricing:** Free (limited) · Basic $6/mo · Pro $16/mo · 300,000+ users
- **Platform:** Web, iOS, Android, browser extension
- **Differentiator:** "Death to organizing" — AI automatically connects, tags, and resurfaces everything. **Full-content indexing of saved web pages** (saves actual text, not just URLs). Semantic search from the free tier. Integrates with Gmail, Dropbox, Google Drive, Notion.
- **Weaknesses:** No offline mode. Pro at $16/mo expensive.
- **Notable:** Full-content web archiving — search the text of saved articles even if the original page is deleted.

### Day One

- **Pricing:** Free (unlimited text, E2E encryption) · Silver $49.99/yr (media + sync) · Gold $74.99/yr (full AI)
- **Platform:** iOS, Android, macOS, Windows, Web, Apple Watch — 15M+ downloads, 4.8/5 App Store
- **Differentiator:** Premium journaling with richest media support (voice, video, photo, handwriting). On-This-Day resurfacing. Print physical books from journal. Gold tier: AI Daily Chat.
- **Weaknesses:** AI locked behind $74.99/yr Gold. Not a retrieval/knowledge tool. Annual billing only.
- **Notable:** **On-This-Day** — seeing exactly what you wrote on this date in previous years. Highest emotional resonance in the category.

### Anytype

- **Pricing:** Free (full features, 1 GB) · Plus ~$5/mo · Pro ~$10/mo — most generous free tier in category
- **Platform:** Windows, macOS, Linux, iOS, Android — peer-to-peer sync, fully offline
- **Differentiator:** End-to-end encrypted, peer-to-peer, local-first. 12-word recovery phrase (crypto-wallet model). Object-based like Capacities. Nobody can read your data — not even Anytype.
- **Weaknesses:** Steep object/type learning curve. AI features less mature.
- **Notable:** P2P sync — no central cloud server holds your data. **Only mainstream PKM with true data sovereignty.**

### Tana

- **Pricing:** Free beta · Plus $10/mo · Pro $18/mo
- **Platform:** Web, iOS (mobile capture), offline added 2025
- **Differentiator:** "Supertags" — tags have properties, inherited fields, and AI behaviors. Tag something "Book" and AI auto-fetches author, year, genre, summary. **Most AI-native structural PKM in the market.**
- **Weaknesses:** Steep learning curve. $18/mo for Pro. Still feels unfinished.
- **Notable:** Supertag AI automation — AI runs on your data according to rules you define per type.

### Apple Notes / Google Keep (baseline)

- **Pricing:** Free (5 GB iCloud shared / 15 GB Google account shared)
- **Platform:** Apple Notes: iOS/macOS only. Google Keep: cross-platform.
- **Differentiator:** Zero friction, zero setup, built into the OS. Largest installed base by far.
- **Weaknesses:** No AI retrieval. No semantic search. No graph/backlinks. No structured types. Keep is not serious note-taking.
- **Notable:** Apple Notes document scanning best-in-class. Google Keep image OCR.

---

### CortexOS — privacy-first on-device journaling

Researched 2026-05-04. Source: <https://cortexos.app/terms/>.

- **Pricing:** Free (basic, 50 entries/mo, 3 emotions) · Premium $9.99/mo or $79.99/yr (14-day trial) · Lifetime $199.99 one-time
- **Platform:** iOS + Android (both with on-device LLM)
- **Differentiator:** On-device Llama 3.2 (1B/3B). iOS uses MLX on Neural Engine + CoreML; Android uses TensorFlow Lite. **Zero cloud AI calls** by default. Optional zero-knowledge encrypted cloud vault with AES-256-GCM, Argon2id key derivation, 6-word recovery phrase + 4-digit PIN.
- **Core features:** AES-256-GCM encrypted journal, 20+ emotion detection, sentiment analysis, cognitive distortion alerts, on-device Whisper voice-to-text, NLP-based reminder detection, behavioral pattern detection, Android home-screen widget.
- **Positioning:** "Your Mind, Encrypted." Privacy-first journaling, explicitly not a mental health treatment substitute.
- **Weaknesses:** Single-user only — no shared brains, no family/team. On-device 1B/3B Llama is meaningfully weaker than Gemini 2.5 Flash for Q&A over personal data. Journaling-only — not generalised personal-admin memory. No share-target capture from other apps.
- **Threat to Everion:** **Medium.** Same privacy-first promise (E2E vault, no cloud AI). But scope is narrower (journaling) and the on-device LLM ceiling limits chat-quality. If their roadmap broadens to "general life memory," they become a direct competitor with a credible privacy story. Watch their changelog.

### Cortex — Private AI Assistant (Pratik Poudel) — calendar planner

Researched 2026-05-04. Source: <https://apps.apple.com/us/app/cortex-private-ai-assistant/id6759742402>.

- **Pricing:** Free
- **Platform:** iOS 17+, iPadOS 17+, macOS 14+ (M1+), visionOS — Apple-only.
- **Differentiator:** Calendar-aware AI assistant. On-device only. Summarises schedule, spots conflicts, creates events from natural language. Image-aware chat.
- **Positioning:** "Private by default and fast on your device." Daily-planning + AI chat hybrid.
- **Weaknesses:** Apple-only (no Android, no web). Calendar-narrow — not a general personal-memory product. No shared brains. No structured types beyond events. Solo dev (Pratik Poudel) — fragility risk.
- **Threat to Everion:** **Low.** Different category — calendar planner, not life-admin memory. Same word "Cortex" is a brand-confusion risk; **flag as a name to avoid** if the brand decision is still open. (See `Legal/trademarks-domains.md` and `BRAINSTORM.md` brand-name shortlist.)

### Everloom.app — "second brain is loading"

Researched 2026-05-04. Sources: <https://www.everloom.app/>, marketing search results.

- **Pricing:** TBD — site is a pre-launch/waitlist landing
- **Platform:** TBD
- **Differentiator (claimed):** "Save moments. Share memories. Let AI remember for you." Tagline-only product; no shipped features visible.
- **Positioning:** Generic "second brain" + "AI memory" — same category, same surface promise as Everion. "Share memories" implies multi-user / family-shared from day one.
- **Weaknesses:** Vapourware as of 2026-05-04. No public pricing, no platform commitment, no privacy claims, no shipped feature surface.
- **Brand confusion:** **Significant.** "Everloom" is one consonant from "Everion." If Everloom ships first or markets aggressively, organic traffic for "ever\*" memory apps splits. Consider: defensive registration of `everloom.com`/`.app` variants is a non-starter (taken), but `evara`-family domains avoid the collision entirely. (See `Legal/trademarks-domains.md`.)
- **Threat to Everion:** **Medium-High latent.** Same category, same naming bucket, unknown team capacity. Watch them quarterly. If they ship a polished product first, they get the SEO + tech-press coverage we need. **Track their Twitter / Product Hunt / Indie Hackers presence.**

### Everkeep — time-locked future memories (no AI)

Researched 2026-05-04. Sources: <https://everkeep.app/>, <https://apps.apple.com/vn/app/everkeep/id6748815343>.

- **Pricing:** Free with IAP — Monthly ₫79,000 (~USD $3.20) · Yearly ₫799,000 (~USD $32) — Vietnamese-dong pricing visible; USD store may differ
- **Platform:** iOS + iPadOS + macOS + visionOS — Apple-only
- **Differentiator:** Time-locked memory vaults that unlock on a chosen future date. Designed for "future memories" — letters to your future self, milestone messages to family, anniversary surprises. Themes + backgrounds for emotional polish.
- **Positioning:** "Preserve Your Future Memories" — emotional / sentimental. Explicitly forward-looking, not archival.
- **AI involvement:** **None disclosed.** No semantic search, no AI chat, no enrichment.
- **Privacy:** Developer claims "Data Not Collected" on App Store — minimal privacy claim, no encryption details disclosed.
- **Weaknesses:** Apple-only. No AI. Niche use case — most users don't need a "letter-to-future-self" app monthly; LTV is low. No web. No share-target capture. The "vault" word here means time-locked-until-date, not E2E encryption — different mental model than Everion's vault.
- **Threat to Everion:** **Low.** Different use case — sentimental future-letter delivery vs. life-admin memory. Could become a Pro-tier feature for Everion ("schedule this entry to surface on YYYY-MM-DD") at trivial implementation cost. **Worth lifting their "themes + backgrounds" UI polish for memory cards** — emotional-design lesson, not feature copy.

---

## What users consistently praise (cross-app)

| Feature                       | App      | Why it works                                                            |
| ----------------------------- | -------- | ----------------------------------------------------------------------- |
| Spaced-repetition resurfacing | Readwise | Re-encountering your own highlights in context feels useful, not random |
| Folder-free organization      | Mem      | No "where do I file this?" friction                                     |
| On-This-Day                   | Day One  | Emotional resonance of seeing your past self                            |
| Data portability (Markdown)   | Obsidian | Plain files that will outlast any company                               |
| Speed                         | Reflect  | Fastest capture-to-saved experience                                     |
| Full-content web archiving    | Fabric   | Search what a page said, not just that you saved it                     |
| Supertag AI automation        | Tana     | AI that works on your data by your own rules                            |
| Privacy architecture          | Anytype  | Genuine peace of mind, not marketing                                    |

---

## What users consistently complain about (cross-app)

1. **Pricing creep + AI gating.** Notion's $15/user Business move (May 2025) generated the year's biggest backlash. Users are exhausted by subscription stacking.
2. **No Android / weak Android.** Mem has none. Obsidian Android sync is broken. Capacities Android is buggy. Huge underserved market.
3. **Setup friction.** Obsidian, Tana, Capacities require weekend-long config before becoming useful.
4. **Search accuracy.** Even semantic search in Mem and Fabric sometimes fails to surface what users know is there.
5. **Privacy concerns with AI.** Meta acquisition of Limitless caused immediate user exodus. Read AI and Notion AI both pushed back on for opaque data policies.
6. **Slow mobile performance.** Readwise Reader, Obsidian Android, Capacities mobile all cited.
7. **Capture friction.** Users want to save an idea in under 3 seconds. Apps requiring navigation before capture lose users.
8. **The graveyard problem.** Users capture everything but never revisit it. Apps without active resurfacing feel like writing into a void.

---

## Everion's strongest competitive advantages

- **Real Android support** as a web app (Mem has none; Obsidian is broken on Android)
- **Encrypted vault/secrets as a native capture type** — no competitor does this at all
- **Contacts as a native memory type** — only Tana and Capacities come close, both at far higher complexity
- **AI chat over personal memory** without $15/mo+ pricing

---

## Everion's most exploitable competitor gaps

- **Mem's missing Android app** — large market of Android users who want AI-organized notes
- **Reflect's no-free-tier wall** — price-sensitive users looking for a polished alternative
- **Obsidian's setup hell** — users who want power without configuration
- **Limitless's post-acquisition vacuum** — the ambient capture concept is orphaned; no good successor exists
- **The graveyard problem is unsolved** — most apps capture well, almost none resurface well
- **CortexOS's narrow scope (journaling-only)** — privacy-first users who want general life-admin memory, not just emotional journaling, have no shipped option that matches both promises
- **Apple-only privacy plays (Cortex Poudel, Everkeep, Apple Notes)** — Android users who want privacy don't have a strong story to switch to; web + Android coverage is genuine moat
- **Everkeep's "future-self letter" niche** — could absorb as a Pro-tier feature (scheduled-resurface entry) without building a separate product

---

## Five MVP principles (research-distilled)

These are the cross-cutting principles every successful "second brain" implementation respects. Source: AI-research synthesis of the second-brain category, April 2026.

### 1. Speed and low friction

The most important criterion: must be **faster than pen and paper.** If opening the app and creating a note takes too long, users stop using it. Aim for an **invisible note-taking interface** — start typing immediately without creating nodes, adding blocks, or choosing properties first. High performance + "near 100% uptime" non-negotiable for a daily driver.

### 2. Privacy by design + data ownership

E2EE is **no longer optional**; it's the gold standard. To build trust:

- **Avoid data training** — personal data not used to fuel AI without explicit consent
- **Local storage** — data available offline; not dependent on company servers
- **Exportability** — open formats so users don't feel trapped

### 3. Master capture-organize-retrieve

The fundamental loop:

- **Capture** — minimize friction (mobile widgets, voice-to-text)
- **Organize** — flexible categories, tags, or bidirectional linking; **avoid rigid filing systems**
- **Retrieve** — solid search; system fails if it can't surface info without the user remembering exactly where they put it

### 4. Solve cognitive overload

Position as relief from "brain fog" caused by information overload. Be the **single source of truth** that reduces mental fatigue from juggling tasks across scattered apps + sticky notes.

### 5. Start simple, avoid feature bloat

Common pitfall: overcomplicating early, worsening "digital overwhelm." **Master one core platform/workflow** before adding sophisticated features (AI agents, complex databases). Provide a **complexity-free writing environment** where the tool is an enabler, not a distraction.

---

## Capture-interface design principles (research-distilled)

For the frictionless capture interface specifically, these patterns produce the highest user satisfaction:

### Invisible writing environment

- **Immediate cursor focus** on app open — no node creation, no block selection, no Markdown formatting required first
- **Capture now, organize later** — no tags/folders/links required at moment of capture
- **Dumb-tool simplicity** beats feature-rich clutter for raw entry speed

### Native OS entry points

- Lock screen + home screen widgets (one-tap from locked device)
- Control Center / Quick Settings tile
- Voice assistant integration (Siri / Google Assistant: "Capture using Everion…")
- System Share Sheet (capture from any app)

### Chat / messaging-style entry

- Conversation-to-object pattern (chat with brain → AI creates structured objects later)
- Digital sticky notes for sudden inspirations + checklists

### Performance targets

- Response time **< 4 seconds** for data entry/updates
- **99.5% availability** during peak hours
- Clean, direct, consistent UI — zero learning curve for new users

### Offline-first

**100% capture must work offline.** Users need to capture in dead zones (planes, cafés without Wi-Fi). Sync automatically when connection returns.

### Specialized capture clippers

- Browser extension for articles, highlights, references
- Smart content handling (YouTube → notes, Readwise highlight sync)
- Share Sheets for links, photos, text from other apps

---

## Where Everion already implements these principles

| Principle                                | Status in Everion                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| Speed: invisible writing                 | ✅ CaptureSheet opens to focused textarea, no type selection required first |
| Privacy by design                        | ✅ E2EE vault (AES-GCM 256), GDPR delete cascade, full data export          |
| Local-first / offline                    | ✅ Offline queue, PWA, service worker                                       |
| Capture-organize-retrieve                | ✅ Capture (text/voice/file/paste), AI auto-categorize, OmniSearch retrieve |
| Single source of truth                   | ✅ One capture surface → entries + secrets + todos + facts in one inbox     |
| Avoid feature bloat                      | 🟡 Roadmap Week 1 explicitly prunes nav back to 5 items                     |
| Mobile widgets                           | ❌ Capacitor wrap on roadmap (M0 Mobile track)                              |
| Native OS share sheet                    | ❌ Capacitor wrap track                                                     |
| Voice assistant integration              | ❌ Post-launch (Siri/Google Assistant)                                      |
| Browser extension                        | ❌ Post-launch                                                              |
