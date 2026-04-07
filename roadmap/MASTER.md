# OpenBrain — Master Planning Document

> Consolidated from: ROADMAP.md · future-plans.md · adversarial-review.md · Claude-brain.md · Todo.md  
> Last updated: 2026-04-07

---

## Vision

OpenBrain is **not chat.** It is a system that maintains a continuous, evolving model of a user's mind. All engineering decisions must reinforce this invariant.

OpenBrain starts as a personal second brain, then expands to shared brains for families and businesses, and ultimately becomes a platform where anyone can create their own OpenBrain with optional shared spaces.

---

## Guiding Principles

1. **Capture should be effortless** — if it takes more than 5 seconds, people won't do it
2. **The AI should think for you** — classify, connect, remind, surface — not just store
3. **Shared doesn't mean complicated** — inviting someone should be as easy as sharing a WhatsApp link
4. **Your data is yours** — export everything, delete everything, no lock-in
5. **Start simple, grow with the user** — a new user sees a clean personal brain, not a complex platform

---

## Shipped

- [x] **Core App** — Capture, search, graph, timeline, calendar, chat
- [x] **AI Parsing** — Claude-powered entry extraction from text, voice, images
- [x] **Multi-Brain** — Personal, Family, Business brains with role-based sharing
- [x] **Offline-First** — IndexedDB queue with auto-sync on reconnect
- [x] **Onboarding** — 30 starter questions, brain type selection, guided setup
- [x] **PIN Security** — Sensitive content gating with PIN/biometric
- [x] **Mobile UI Fix** — Responsive layout, overflow fixes, sync reliability
- [x] **Brain API Keys** — Per-brain API key system (`migration 012`)
- [x] **Flexible Entry Types** — Dynamic type system, no hardcoded whitelist (`migration 013`)

---

## In Progress

### Community Brain
**Spec:** `docs/superpowers/specs/2026-04-03-community-brain-design.md`  
**Plan:** `docs/superpowers/plans/2026-04-03-community-brain.md`

A new brain type for groups larger than a household — neighbourhoods, clubs, stokvels, schools, hobby groups. Enables shared collective memory with join links, optional moderation, and public discovery.

| Phase | What | Status |
|-------|------|--------|
| Phase 1 | Community type + join links | Planned |
| Phase 2 | Moderation (admin approval queue) | Planned |
| Phase 3 | Discovery (browse public communities) | Planned |
| Phase 4 | Community management (settings, members) | Planned |
| Phase 5 | Scale & trust (reporting, AI screening) | Future |

**Why it matters:** Communities lose institutional knowledge every time a committee rotates, a WhatsApp group gets buried, or a key person leaves. A community brain is permanent collective memory.

---

## Immediate Manual Actions Required

- **Revoke leaked Telegram Bot Token** — flagged by GitGuardian on commit `d811ad2`. Go to @BotFather → `/revoke`, generate new token, update `BOT_TOKEN` / `TELEGRAM_BOT_TOKEN` in Supabase env vars.
- **Update Supabase email template** — Auth → Email Templates → Magic Link, add `{{ .Token }}` so the OTP code is visible for PWA sign-in.
- **Run migration 013 in Supabase SQL editor** — file is at `supabase/migrations/013_flexible_entry_types.sql`. Not auto-applied — must be run manually.
- **Add `RESEND_API_KEY` to Vercel env vars** — required for brain invite emails. Get a free key at resend.com (100 emails/day free). Also add `APP_URL=https://open-brain-ib4e.vercel.app`.

---

## Outstanding Issues

### CRITICAL — Fix Now

**No Soft Delete / No Trash**
- Entries are hard-deleted. No `deleted_at` field, no trash, no recovery.
- Brain deletion cascades and destroys all entries (`ON DELETE CASCADE` in migration 001).
- **Fix:** Add `deleted_at` column, soft-delete by default, Trash view with 30-day auto-purge.

**Offline Sync Silently Drops Data**
- `/src/hooks/useOfflineSync.js:48-95` — After 3 failed retries, operations are permanently removed from the queue. User is never notified.
- `/src/lib/offlineQueue.js:25-37` — IndexedDB/localStorage quota errors are silently swallowed.
- **Fix:** Show persistent banner for failed sync. Keep failed items in a "failed" state. Let users retry or copy content.

**No Backups**
- No scheduled Supabase backups. No full account export (all brains, links, vault keys).
- **Fix:** Set up Supabase scheduled backups (pg_dump cron). Add full account export.

**API Keys in localStorage (XSS Risk)**
- `/src/lib/aiFetch.js:47-162` — All user API keys stored in plaintext localStorage.
- **Fix (short-term):** Add Content Security Policy headers.
- **Fix (long-term):** Server-side key vault — user enters key once, server stores encrypted, proxies AI calls.

**Secrets Sent to External LLMs**
- `/api/chat.js:113-123` — Decrypted vault secrets injected into system prompt and sent to third-party providers.
- **Fix:** Only allow secrets in chat when using Anthropic direct. Block or warn for OpenRouter/OpenAI.

---

### Security

**SEC-12 · Add security headers to all API handlers**  
Files: All `api/*.ts` handlers. No `X-Content-Type-Options` or `X-Frame-Options`.
```ts
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("X-Frame-Options", "DENY");
```

**SEC-16 · Upgrade cron auth to HMAC-signed requests**  
File: `api/cron/push.ts:30` — `CRON_SECRET` bearer check in place but HMAC upgrade pending.  
Fix: Sign with `HMAC-SHA256(CRON_SECRET, timestamp)`; add IP whitelist `76.76.21.0/24` in `vercel.json`.

**ARCH-6 · Move PIN hash server-side**  
Current: PBKDF2 is used (good) but hash stored in `localStorage` — XSS accessible.  
Fix: POST derived key to `/api/pin/verify`; store hash in `user_ai_settings`; remove from `localStorage`.

---

### HIGH — Fix Soon

**Embedding Provider Mismatch**
- Users can switch providers mid-use. Old entries (OpenAI) + new entries (Google) = incompatible vector spaces.
- **Fix:** Warn when switching providers. Prompt to re-embed all entries, or block search until consistent.

**No Token/Cost Tracking**
- No usage logging. Users have zero visibility into API spend.
- **Fix:** Simple token counter (input + output per call) in localStorage or Supabase. Show monthly usage in Settings.

**Metadata Has No Schema**
- `metadata` is freeform JSONB. AI may output `phon` instead of `phone`, or `due_date: "ASAP"`.
- **Fix:** Add validation in `/api/capture.js` — validate date formats and known field names.

**No Bulk Operations**
- No multi-select, no bulk edit, no bulk delete.
- **Fix:** Add multi-select checkboxes. Bulk actions: delete, change type, add/remove tags, move to brain.

**Search is Barebones**
- Simple token-based inverted index. No fuzzy matching, no relevance ranking, no result highlighting.
- **Fix (quick):** Add fuzzy matching. Add result count and match highlighting.
- **Fix (proper):** Hybrid search — combine local text search with semantic (embedding) search.

**Chat Context Too Limited**
- Only top 20 entries with 300-char snippets. No source citations. Link target titles not included.
- **Fix:** Include link target titles. Increase content to 500 chars. Add citation markers.

**Silent Error Handling Everywhere**
- Dozens of empty `catch {}` blocks — errors swallowed without user feedback. Also: `src/OpenBrain.tsx` lines ~281, ~376, ~416, ~604.
- **Fix:** Global toast/notification system. Convert silent catches to user-visible feedback on critical paths.

---

### Performance

**PERF-6 · Debounce `findConnections` / skip during bulk import**  
Auto-link discovery fires on every entry during Fill Brain, hammering the AI API.  
Fix: 5 s debounce; `isBulkImporting` flag to suppress calls during batch; single pass after bulk completes.

---

### MEDIUM — Plan For

**Accessibility Gaps**
- Most icon-only buttons lack `aria-label`. No keyboard navigation for modals. No `aria-live` regions.
- **Fix:** Audit all interactive elements for aria-labels. Add focus-visible styles.

**Mobile Touch Targets**
- Many buttons result in targets well below the 44px minimum.
- **Fix:** Audit all buttons for `minHeight: 44` and `minWidth: 44`.

**Entry Limit / Pagination**
- Hard-coded `limit=500`. Export fetches ALL entries — Vercel timeout risk for large brains.
- **Fix:** Add cursor-based pagination to GET /api/entries. Paginate export.

**Rate Limiting is Per-Instance**
- In-memory fallback is per Vercel instance. Distributed attacks bypass it.
- **Fix:** Set up Upstash Redis (free tier available).

**Vault Key Race Condition**
- Check-then-insert for vault setup has a TOCTOU race.
- **Fix:** Add `UNIQUE` constraint on `vault_keys(user_id)` and use `INSERT ... ON CONFLICT DO NOTHING`.

**Capture Prompt Ignores Workspace**
- CAPTURE prompt outputs `"workspace"` field but the API doesn't store it.
- **Fix:** Either use the workspace field (map to brain assignment) or remove it from the prompt.

**No Notification Test**
- Users can't send a test notification to verify it works. No notification history, no quiet hours.
- **Fix:** Add "Send test notification" button. Add notification log.

---

### Technical Debt

**N+1 Query Patterns**
- `/api/embed.js:110-126` — Batch embed does N separate PATCH requests. Use single bulk PATCH.
- `/api/chat.js:93-95` — Link query builds OR filter with N IDs. Use `from.in.(id1,id2,...)`.

**Fire-and-Forget Audit Logging**
- Audit log writes across `entries.js`, `capture.js`, `brains.js` are fire-and-forget with `.catch(() => {})`.

**Embedding Text Composition**
- `/api/_lib/generateEmbedding.js:46-54` — Entry text is `title + content + tags` with no weighting. Title should carry more weight.

**Similarity Threshold**
- `/api/search.js:33` — Hardcoded 0.4 cosine similarity. Should be configurable or adaptive.

**Onboarding Re-access**
- Onboarding shown once then hidden forever. Users can't re-access guidance.

**Brain API Key Hashing**
- Brain API keys stored in plaintext in `brain_api_keys` table.
- **Fix:** Store bcrypt/argon2 hash. Show key only once at creation.

---

## AI — Per-Task Model Pickers (Settings UI)

Data layer (`getModelForTask`, `loadTaskModels`, `model_capture` etc.) and `callAI()` wiring are done. **The Settings UI is not built yet.**

Add a collapsible **"Advanced: per-task models"** section to `src/views/SettingsView.tsx`, rendered only when `provider === "openrouter"`:

| Label | Task key |
|---|---|
| Entry capture | `capture` |
| Fill Brain questions | `questions` |
| Image reading | `vision` |
| Refine collection | `refine` |
| Brain chat | `chat` |

- Top option: **"Same as global default"** (saves `null`).
- `vision` dropdown: filter to `modality.includes("image")` models only.
- Load from `user_ai_settings` on mount.

Add `priceTier` badges to all model dropdowns:

```ts
function priceTier(pricing) {
  const p = parseFloat(pricing?.prompt ?? 1);
  if (p === 0)       return { label: "Free",      color: "#22c55e" };
  if (p < 0.000001)  return { label: "Cheap",     color: "#4ECDC4" };
  if (p < 0.000010)  return { label: "Normal",    color: "#888" };
  return              { label: "Expensive",  color: "#FF6B35" };
}
```

---

## Strategic Roadmap

### Phase 1 — High Impact, Achievable Now

| Item | Description |
|---|---|
| **Agentic scheduled tasks** | Vercel Cron → `/api/agent`: Memory Synthesizer (weekly `user_memory` rewrite), Expiry Agent (30/7/1-day document alerts), Gap Analyst (scan brain for missing info), Contradiction Detector |
| **Knowledge graph traversal in chat** | When user asks about an entity, fetch its 2-hop `entry_links` neighborhood and include in chat context |
| **Staleness + confidence scoring** | Flag entries not updated in 6+ months; AI marks entries as verified/unverified/contradicted |
| **Observability** | Sentry for frontend errors; Axiom or Datadog for API logs; Vercel Analytics for performance |
| **Push Notifications** | Proactive reminders for expiring documents, upcoming deadlines, and stale entries. Web Push API via service worker. |
| **Smart Suggestions** | AI-driven prompts to fill gaps — "You have 8 suppliers but no insurance provider. Want to add one?" |

### Phase 2 — Business Shared Brain

**Goal:** Teams and businesses share operational knowledge.

Role-based access: Owner, Manager, Staff. Entry categories matter more: suppliers, SOPs, recipes, contacts, schedules. Audit trail of who added/edited what.

**Restaurant-specific features (Smash Burger Bar as template):**
- Supplier directory with reorder actions
- Recipe/prep notes (internal only)
- Staff contact list
- Opening/closing checklists (tied to Todos)
- Equipment inventory with warranty dates
- Cost tracking per supplier/ingredient

**Database additions needed:**
```sql
CREATE TABLE brain_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brain_id uuid REFERENCES brains(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL,
  entry_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE brain_settings (
  brain_id uuid REFERENCES brains(id) ON DELETE CASCADE PRIMARY KEY,
  settings jsonb DEFAULT '{}'::jsonb
);
```

**High value, moderate effort also in this phase:**

| Item | Description |
|---|---|
| **Client-side encryption (E2EE Phase 1)** | Encrypt `entries.content` + `entries.metadata` with AES-256-GCM in browser. Mitigate search loss with client-side MiniSearch index. |
| **PDF ingestion** | Upload lease/contract/recipe → AI extracts key fields → structured entries. `/api/parse-doc` + PDF.js. |
| **Entry versioning** | Content snapshots on every update; `entry_versions` table; user can roll back. |
| **Recurring reminders** | Entry-level reminder settings (e.g. 30 days before expiry, repeat annually). |
| **Markdown / rich text editor** | Tiptap or Milkdown for long-form entries. |
| **Data Export** | Full brain export to CSV, JSON, or PDF. Critical for committee handovers and data portability. |
| **Entry Attachments** | File uploads (PDFs, images, receipts) attached to entries. Stored in Supabase Storage. |

### Phase 3 — Platform (Open to New Users)

**Goal:** Anyone can sign up and build their own OpenBrain.

**Onboarding flow:**
1. Sign up (email/Google/Apple)
2. Personal brain created automatically
3. Guided setup: "What do you want to remember?"
4. Optional: create a shared brain for family or business
5. Invite others

**Monetisation:**
- **Free tier**: 1 personal brain, 100 entries, basic AI (limited Haiku calls/day)
- **Pro tier** (~R99/month or $5/month): unlimited entries, unlimited AI, 2 shared brains, data export
- **Team tier** (~R199/month or $10/month): unlimited shared brains, role-based access, activity log, priority support

**Platform concerns:**
- Rate limiting per user
- API key management: shared Anthropic key with per-user quotas, or BYO key
- POPIA/GDPR compliance: data export, account deletion, privacy policy
- Abuse prevention: content moderation on shared brains

**High value, high effort in this phase:**

| Item | Description |
|---|---|
| **Full E2EE** | Per-brain symmetric keys wrapped with per-user X25519 public keys. `brain_keys` table. |
| **Voice query / TTS** | Speak a question → brain answers aloud via browser Speech API or ElevenLabs. |
| **On-device AI** | WebLLM (Phi-3-mini / Gemma-2B) via WebGPU for offline classification. Ollama for desktop power users. |
| **Smart import** | AI import wizard: parse Notion / Obsidian / Apple Notes / Google Keep exports → map to entry types. |
| **Real-time collaboration** | Supabase Realtime subscriptions → live updates. Comments on entries, @mentions. |
| **Analytics dashboard** | Brain health: entry growth, link density, most-accessed entries, staleness heatmap. |

### Future

| Item | Description |
|---|---|
| **Fine-tuned personal model** | Log AI classification corrections → batch weekly → fine-tune small model. ~500 corrections = near-zero errors. |
| **Native mobile app** | React Native / Capacitor: Share Sheet, Siri Shortcuts, iOS home screen widget. |
| **WhatsApp bot** | Forward messages to OpenBrain, it captures automatically. |
| **Gmail integration** | Auto-capture important emails (receipts, confirmations, bookings). |
| **Calendar sync** | Pull Google Calendar events as reminder entries. |
| **Public brains** | Opt-in shareable knowledge bases (e.g. "Best restaurants in Bloemfontein"). |
| **API write access** | Add write endpoints so external apps (calendar, todo) can sync changes back. |
| **TEE-based AI inference** | Zero-knowledge with frontier AI via Intel TDX / AMD SEV-SNP. Viable ~2027. |
| **POS integration** | Auto-capture daily sales, stock levels (for restaurant brain). |
| **AI agents** | "Every Monday, summarise what changed in the business brain and send to the team." |

---

## Scaling Architecture

### Target Architecture

```
Client (UI)
    ↓
Brain API (Authority Layer)
    ↓
Brain Kernel
    ↓
Memory System
    ↓
Model Providers
```

**Critical Rule:** Only the Brain Kernel mutates cognition.

### 7-Phase Execution Plan

**Phase 1 — Brain Authority (Foundational)**
- Goal: Single source of truth for cognition
- Move all memory writes into `/brain` module, block direct DB writes, add `validateBrainAccess()`
- Done when: UI cannot directly change database cognition

**Phase 2 — Memory Types (Anti-Entropy)**
- Taxonomy: episodic, semantic, goals, plans, beliefs, reflections
- Typed memory schema, `memory_type` enum, retrieval filters
- Done when: Memory queries never mix incompatible cognition types

**Phase 3 — Brain Isolation (1 → 1,000)**
- Goal: Guarantee zero cross-brain contamination
- Row-level security, `brain_id` required on ALL tables, isolation tests
- Done when: Cross-brain access impossible even with malformed requests

**Phase 4 — Schema Versioning (Future-Proofing)**
- Philosophy: Brains migrate forward, never rewrite history
- `brain_schema_version`, migration runner, compatibility adapters
- Done when: Old brains run on new code safely

**Phase 5 — Event-Driven Cognition (1M Brains Enabled)**
- Core events: THOUGHT_CREATED, MEMORY_STORED, PLAN_UPDATED, REFLECTION_TRIGGERED
- Event bus, async workers, queue long reasoning tasks
- Done when: Brain actions no longer block user requests

**Phase 6 — Reflection Loop (Intelligence Multiplier)**
- Goal: Brains improve themselves
- Reflection worker, periodic scheduling, self-analysis storage
- Done when: Brains generate self-analysis automatically

**Phase 7 — Model Abstraction (Provider Independence)**
- Goal: Prevent vendor lock-in
- Provider interface, adapters (OpenRouter, Claude, future); brain calls capability not model
- Done when: Switching models requires zero brain changes

### Scaling Checkpoints

| Stage | Requirement |
|-------|------------|
| 1 Brain | Deterministic state |
| 1,000 Brains | Strict isolation |
| 100,000 Brains | Async cognition |
| 1,000,000 Brains | Event-driven architecture |

**Final Invariant:** OpenBrain scales when adding a new brain is creating data, not creating complexity. If adding users requires new logic, architecture has failed.

---

## Claude Code Automation Boundaries

**Claude Code MAY:**
- Refactor internal modules
- Enforce typing
- Add tests
- Migrate schemas
- Improve performance

**Claude Code MAY NOT:**
- Redefine cognition model
- Change brain invariants
- Alter memory taxonomy
- Introduce new authority layers

---

## Success Metrics

- Brain load time < 200ms metadata fetch
- Memory retrieval deterministic
- Zero cross-user reads
- Schema upgrades non-breaking
- Reflection loop operational

---

## What's Working Well

Worth noting what doesn't need fixing:

- **Vault encryption** — AES-256-GCM, non-extractable keys, PBKDF2 310k iterations, recovery key flow.
- **Auth flow** — Supabase JWT + `verifyAuth` on every endpoint. `checkBrainAccess` for brain-level permissions.
- **Input validation** — Content capped at 10k chars, tags at 50, title at 500. No SQL injection possible.
- **Offline-first architecture** — IndexedDB cache with localStorage fallback. Entries render immediately from cache.
- **AI prompt design** — Structured, specific, with format enforcement. ENTRY_AUDIT is particularly well-designed.
- **Multi-brain system** — Clean separation. Role-based access. Cross-brain sharing via junction table.
- **Refine view** — Unique feature. AI-powered data quality auditing with accept/reject/edit flow.
