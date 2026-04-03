# OpenBrain — Strategic Gaps Analysis
> What it would take to make this world-class in 2026 and beyond.

---

## Context

OpenBrain is a personal second-brain app that lets individuals, families, and small businesses capture, connect, and recall knowledge using AI. It collects deeply sensitive data: medical notes, financial records, family details, business secrets, legal documents, and identity information.

The frontier of AI is moving fast. This document maps the gaps between where OpenBrain is today and where a world-class knowledge platform needs to be — across AI intelligence, data security, architecture, and product.

---

## Part 1 — Data Security & Encryption

> This is the most important section. The app holds data that, if stolen, could ruin lives and businesses.

### The Core Problem

Right now, all data is stored **in plaintext in Supabase PostgreSQL**. Supabase encrypts the disk at rest (AES-256) and enforces TLS in transit — but that protects against hardware theft, not against:

- A compromised Supabase service account or admin
- A misconfigured RLS policy (known vulnerability in the codebase)
- A malicious Supabase employee
- A data breach at Supabase's infrastructure provider
- A compromised Vercel function leaking the `SUPABASE_SERVICE_ROLE_KEY`
- A subpoena or government request to Supabase

**The only way to make data "impossible to steal" is End-to-End Encryption (E2EE) — where the server never sees plaintext.**

---

### What E2EE Means for OpenBrain

#### Zero-Knowledge Architecture
The server stores only **ciphertext**. Users hold the keys. Even Supabase, Vercel, and OpenBrain itself cannot read the data.

```
User types entry
  → Browser encrypts entry with user's key
  → Ciphertext stored in Supabase
  → On load: ciphertext fetched, decrypted in browser
  → Server never sees plaintext
```

#### How to implement it

**Key derivation:**
- On account creation, derive a symmetric key from the user's identity using `PBKDF2` or `Argon2id`
- Since the app uses magic link auth (no password), the key must come from somewhere else:
  - Option A: **Passphrase** — user sets a separate encryption passphrase on first login (separate from auth)
  - Option B: **Device-bound key** — key stored in browser's `SubtleCrypto` / `CryptoKey` non-exportable (device-locked, no passphrase needed)
  - Option C: **Hybrid** — device key + server-encrypted backup key (for account recovery)

**Encryption algorithm:**
- `AES-256-GCM` for entry content (authenticated encryption — detects tampering)
- `X25519` (ECDH) for shared brain keys (so multiple members can decrypt the same brain)

**Key sharing for shared brains:**
- Each brain has a symmetric `brainKey`
- On invite, wrap `brainKey` with the invitee's public key: `encrypt(brainKey, invitee.publicKey)`
- Stored in a `brain_keys` table (encrypted blob per member)
- Each member decrypts `brainKey` with their private key on load

**What gets encrypted:**
- `entries.title` — yes
- `entries.content` — yes
- `entries.metadata` — yes (contains phone numbers, prices, addresses)
- `entry_links.rel` — yes (relationship labels)
- `user_memory` — yes (AI-synthesized personality summary)
- `messaging_connections.platform_user_id` — yes

**What stays plaintext (needed for server queries):**
- `entries.brain_id` — needed for RLS
- `entries.type` — needed for filtering server-side
- `entries.created_at`, `updated_at` — needed for sorting
- `entries.tags` — searchable; can be hashed (tag fingerprints) for server-side filtering without exposing values

---

### The E2EE vs. AI Tension

This is the hardest problem. **AI analysis requires plaintext. E2EE means the server never has plaintext. These two requirements conflict.**

There are four ways to resolve it:

#### Option 1: Client-Side AI (Local Models)
Run the AI model in the browser using WebLLM or Ollama.
- **Pros:** True E2EE preserved end-to-end. Data never leaves the device.
- **Cons:** Models are large (2GB+), slow on mobile, and far less capable than frontier models.
- **Verdict:** Viable for capture/classification. Not viable for complex reasoning today. Will become viable in 2027–2028 as on-device models improve.

#### Option 2: Decrypt → AI → Re-encrypt in Browser
User's device decrypts entries, sends plaintext to AI provider (Anthropic/OpenRouter) directly from the browser, then re-encrypts and stores the result.
- **Pros:** No plaintext ever touches OpenBrain servers. AI gets full context.
- **Cons:** Plaintext goes to Anthropic/OpenRouter — not zero-knowledge with respect to those providers. Network interception risk if TLS is compromised.
- **Verdict:** Best practical option for now. OpenBrain servers stay zero-knowledge. AI providers see plaintext (acceptable if users understand this).

#### Option 3: Trusted Execution Environment (TEE)
Run AI inference inside a hardware-attested enclave (Intel TDX, AMD SEV-SNP). The TEE decrypts, processes, and re-encrypts — no human can see the plaintext even on the server.
- **Pros:** True zero-knowledge with full AI capability.
- **Cons:** Complex to set up, requires attestation infrastructure, limited provider support in 2026.
- **Verdict:** The gold standard. Worth exploring as Confidential Computing matures (Edgeless Systems, Anjuna, Azure Confidential Computing).

#### Option 4: Homomorphic Encryption
AI inference directly on ciphertext — never decrypts.
- **Pros:** Perfect privacy.
- **Cons:** 1000–10,000x slower than plaintext computation. Not viable for LLMs in 2026.
- **Verdict:** Research only. Not ready for production.

---

### Recommended Encryption Roadmap

| Phase | What | Outcome |
|---|---|---|
| **Now** | Fix PIN (PBKDF2 + random salt, 6-digit minimum, server-side storage) | Eliminate the weakest attack surface |
| **Now** | Remove server API key fallback on `/api/anthropic` | Stop cost attacks and key leakage |
| **Now** | Rotate to distributed rate limiting (Vercel KV / Upstash) | Fix serverless rate limit bypass |
| **Phase 1** | Encrypt `entries.content` and `entries.metadata` with AES-256-GCM client-side | Most sensitive fields protected even if DB is breached |
| **Phase 2** | Full E2EE with per-brain keys + X25519 sharing for brain members | Zero-knowledge server architecture |
| **Phase 3** | Move AI calls to browser (decrypt → call AI provider → re-encrypt) | OpenBrain servers never see plaintext |
| **Future** | TEE-based inference | True zero-knowledge with frontier AI |

> Note: Client-side encryption makes server-side search impossible. The trade-off is privacy vs. searchability. Mitigate with: client-side search index (MiniSearch), or bloom filters for tag matching.

---

### Additional Security Gaps (Critical)

| Gap | Risk | Fix |
|---|---|---|
| No app-level auth on delete/update | RLS misconfiguration = any user deletes any entry | Add explicit brain membership check in handlers |
| In-memory rate limiter | Bypassed in serverless; DDoS/cost attack | Vercel KV or Upstash Redis |
| Cron endpoints no IP whitelist | Brute-forceable | Whitelist `76.76.21.0/24` (Vercel cron IPs) |
| `SUPABASE_SERVICE_ROLE_KEY` in Vercel env | If Vercel is breached, full DB access | Scope to minimum privileges; rotate regularly |
| No SIEM / anomaly detection | Breach undetected | Integrate Supabase audit logs into alerting (Axiom, Datadog) |
| No data retention policy | Legal liability | Add explicit retention + GDPR/POPIA deletion pipeline |
| API keys stored plaintext in user_ai_settings | DB breach exposes user API keys | Encrypt with user key before storing |

---

## Part 2 — AI Intelligence Gaps

> Where the app is vs. where frontier AI enables it to go.

### 2.1 Agentic AI

**Current state:** OpenBrain is reactive — it responds to explicit user actions. The AI is a tool, not a collaborator.

**Frontier:** Autonomous AI agents that act on behalf of the user without prompting.

**Gap:** No scheduled agent tasks. No multi-step reasoning chains. No tool-using agents.

**Opportunities:**

| Agent | What it does |
|---|---|
| **Memory Synthesizer** | Runs weekly, reads all entries, rewrites `user_memory` with updated profile, flags contradictions |
| **Expiry Agent** | Monitors document expiry dates, creates reminder entries 30/7/1 day before |
| **Gap Analyst** | Scans brain weekly, identifies what's missing (no supplier backup contact, no emergency plan), asks targeted questions |
| **Relationship Mapper** | Periodically re-runs link discovery across all entries, not just new ones |
| **Daily Briefing** | Each morning, synthesizes what's due today, what's expiring, what's worth revisiting |
| **Contradiction Detector** | Finds entries that conflict (e.g., two different prices for same supplier) |

**Implementation:** Vercel Cron + a dedicated `/api/agent` endpoint that chains multiple AI calls with tool use (Anthropic's tool use API or OpenAI function calling). Each agent run is logged to `brain_activity`.

---

### 2.2 Multimodal Input

**Current state:** Text + images (via vision models). That's it.

**Frontier:** Voice, documents, screenshots, video frames, real-time capture.

**Gaps:**

| Input type | Status | Opportunity |
|---|---|---|
| Voice memo | Missing | Whisper API transcription → capture pipeline. One tap to record, AI structures it. |
| PDF ingestion | Missing | Upload a lease, recipe, contract → AI extracts key fields → structured entries |
| Screenshot OCR | Partial (image upload) | Auto-OCR receipt → expense entry with amount, vendor, date in metadata |
| Email forwarding | Planned | Forward a confirmation email → AI extracts booking, adds to brain |
| WhatsApp forwarding | Planned | Share any WhatsApp message to bot → auto-captured |
| Video frames | Missing | Record a 10-second video of a document → AI extracts text |
| Calendar sync | Missing | Google Calendar events → auto-create entries with dates, participants |

---

### 2.3 Structured Knowledge Graph

**Current state:** Entry links are basic (from_id → to_id with a label). No graph reasoning. No traversal. No visualization of paths.

**Frontier:** A true knowledge graph where AI can reason across connected nodes.

**Gap:**
- Graph view exists but is static and visual-only
- AI cannot traverse the graph when answering questions ("Who are all the people connected to our main supplier?")
- No relationship types schema (just freeform labels)
- No bidirectional reasoning

**Opportunity:**
- Define relationship type taxonomy (works_at, supplies, knows, lives_at, owns, manages, expires_on)
- Add graph traversal to chat context: when user asks about an entity, fetch its 2-hop neighborhood
- AI answers with richer context ("Mario supplies mozzarella → works for DairyCo → DairyCo also supplies feta to 3 other clients")

---

### 2.4 Proactive Intelligence

**Current state:** Nudge system generates one reminder per cron run. It's reactive and generic.

**Frontier:** AI that knows your patterns, anticipates needs, and surfaces the right thing at the right time.

**Gaps:**
- No temporal pattern detection ("You always reorder buns on Thursdays")
- No priority scoring on entries
- No "this week's focus" synthesis
- No confidence scoring on entries (some info may be stale or unverified)
- No cross-brain insights (personal brain and business brain could inform each other)

**Opportunities:**
- **Staleness scoring:** Flag entries not updated in 6+ months with "is this still true?"
- **Confidence tagging:** AI marks entries as verified/unverified/contradicted
- **Pattern detection:** Track recurring events, flag anomalies
- **Weekly digest email/push:** AI-composed summary of what matters this week
- **Entry aging:** Entries that haven't been accessed in 90 days get "archived" suggestion

---

### 2.5 Voice Interface

**Current state:** No voice input or output.

**Frontier:** Conversational AI interfaces are becoming the primary UX for knowledge retrieval.

**Gap:** The app is 100% text-driven. No speech-to-text, no text-to-speech response.

**Opportunity:**
- **Voice capture:** Hold button → speak → Whisper transcribes → AI structures the entry. Faster than typing on mobile.
- **Voice query:** Speak a question → brain answers aloud (TTS via browser Speech API or ElevenLabs)
- **Telegram voice notes:** Telegram bot already exists; add Whisper transcription for voice messages sent to bot

---

### 2.6 On-Device / Local AI

**Current state:** All AI calls go to cloud providers (Anthropic, OpenRouter, OpenAI). Requires internet, costs money, exposes plaintext.

**Frontier:** On-device models are becoming capable enough for classification, summarization, and simple Q&A.

**Gap:** No local model option. App is 100% cloud-AI dependent.

**Opportunity:**
- **WebLLM** (in-browser): Run `Phi-3-mini` or `Gemma-2B` in the browser via WebGPU
- **Use case:** Offline classification when no API key is set; privacy-preserving capture
- **Ollama integration:** Desktop users can point the app at a local Ollama endpoint as AI provider
- **Hybrid:** Local for classification (cheap, fast), cloud for complex reasoning (chat, link discovery)

---

### 2.7 Fine-Tuned Personal Model

**Current state:** Generic frontier models (Sonnet, GPT-4o) are used with prompt engineering.

**Frontier:** Fine-tuning on the user's own data produces dramatically better classification accuracy.

**Gap:** No fine-tuning pipeline. Models don't learn from corrections.

**Opportunity:**
- When users correct an AI classification (wrong type, wrong metadata), log the correction
- Batch corrections weekly → fine-tune a small model (GPT-4o-mini fine-tune or `claude-haiku` fine-tune when available)
- After ~500 corrections, the model knows "for this user, 'Francesca' is always type=person in the supplier workspace"
- **Result:** Near-zero classification errors for power users

---

## Part 3 — Product & UX Gaps

> Features that world-class second-brain apps have that OpenBrain lacks.

### 3.1 Markdown & Rich Text
- Current: Plain text only
- Gap: No formatting, no headers, no bullet lists, no code blocks
- Opportunity: Integrate a lightweight rich text editor (Tiptap, Milkdown) for long-form entries

### 3.2 Templates
- Gap: No entry templates for common types (Contact, Supplier, Recipe, Medical, Emergency)
- Opportunity: One-tap templates that pre-fill the right fields for each brain type

### 3.3 Smart Import
- Gap: No bulk import from Notion, Apple Notes, Obsidian, Google Keep
- Opportunity: AI-powered import wizard: parse any export format, map to OpenBrain entry types

### 3.4 Collaboration Features
- Gap: No real-time co-editing, no comments on entries, no @mentions
- Opportunity: Supabase Realtime subscriptions → live updates when a family member adds an entry

### 3.5 Entry History / Versioning
- Gap: Entries can be edited but history is lost (only audit log of create/edit events, not content diffs)
- Opportunity: Store entry versions (content snapshots) so users can roll back to previous versions

### 3.6 Reminders with Recurrence
- Gap: Expiry reminders are one-shot. No recurring reminders.
- Opportunity: Entry-level reminder settings (remind me 30 days before expiry date, repeat annually)

### 3.7 Mobile App (Native)
- Gap: PWA works but lacks deep OS integration (Siri Shortcuts, Share Sheet, iOS Widgets)
- Opportunity: React Native wrapper or Capacitor for native app store distribution with:
  - Share Sheet: share anything to OpenBrain from any app
  - Siri Shortcut: "Hey Siri, add to my brain..."
  - Home screen widget showing today's nudge

### 3.8 Analytics & Insights Dashboard
- Gap: No visibility into how knowledge is growing over time
- Opportunity: Brain health dashboard showing entry growth, link density, most-accessed entries, staleness heatmap

---

## Part 4 — Infrastructure & Scale Gaps

### 4.1 Distributed Rate Limiting
- **Gap:** In-memory rate limiter bypassed in serverless (each Vercel instance has its own counter)
- **Fix:** Upstash Redis (edge-compatible) or Vercel KV for shared rate limit state

### 4.2 Observability
- **Gap:** No error tracking, no performance monitoring, no alerting
- **Fix:** Sentry for errors, Axiom or Datadog for logs, Vercel Analytics for performance

### 4.3 TypeScript
- **Gap:** Entire codebase is JavaScript. No type safety.
- **Fix:** Incremental migration (add `.d.ts` for API interfaces first, migrate component by component)

### 4.4 Frontend Modularity
- **Gap:** `OpenBrain.jsx` is 1,566 lines. Impossible to test or parallelize development.
- **Fix:** Split into route-level components (SettingsPage, GraphPage, CalendarPage, etc.)

---

## Priority Matrix

| Gap | Impact | Effort | Priority |
|---|---|---|---|
| Fix critical security vulnerabilities (rate limiting, PIN, API key fallback) | CRITICAL | Low | **Do now** |
| Client-side encryption of entry content | CRITICAL | Medium | **Do now** |
| Voice capture (Whisper) | High | Low | Phase 1 |
| Agentic scheduled tasks | High | Medium | Phase 1 |
| Full E2EE (per-brain keys, X25519) | Very High | High | Phase 2 |
| On-device AI option | Medium | High | Phase 2 |
| Fine-tuned personal model | High | High | Phase 3 |
| Knowledge graph traversal in AI | High | Medium | Phase 2 |
| Distributed rate limiting | High | Low | **Do now** |
| Entry versioning | Medium | Medium | Phase 2 |
| Native mobile app | High | Very High | Phase 3 |
| TEE-based AI inference | Very High | Very High | Future |

---

## The Vision

A world-class OpenBrain is:

1. **Impossible to breach** — E2EE means a full database dump is worthless to an attacker. Only the user's device can decrypt.
2. **Proactively intelligent** — Agents run continuously, surfaces insights before the user asks, learns patterns, flags contradictions.
3. **Context-complete** — RAG (in-flight: pgvector + semantic search) means the AI answers from the full history of the brain, not just the last 50 entries. Next step: extend to graph traversal for multi-hop reasoning.
4. **Frictionless to capture** — Voice, photo, screenshot, email forward, share sheet — any input mode, instant structured capture.
5. **Cross-platform ubiquitous** — PWA + native app + Telegram bot + WhatsApp + email. The brain is everywhere the user is.
6. **Personally trained** — After 6 months of use, the AI knows this user's terminology, preferences, and patterns better than any generic model.

---

*Generated: 2026-04-03*
