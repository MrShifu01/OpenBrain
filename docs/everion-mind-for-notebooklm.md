# Everion Mind — How It All Fits Together

> A source brief for NotebookLM. Paste this in and ask for a one-page infographic
> showing the app's architecture, pipelines, workflows, and how the pieces
> connect.

---

## 1. The One-Sentence Pitch

Everion Mind is a personal **second brain** — capture anything (text, voice,
secrets), AI enriches and indexes it in the background, retrieve it later by
asking in natural language, and drop the actionable bits onto a calendar or
into a "someday" inbox.

---

## 2. The Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript, served as a PWA |
| Hosting | Vercel (Hobby tier — hard cap of **12 serverless functions**) |
| Database | Supabase (Postgres + Row-Level Security + JSONB metadata) |
| AI provider | **Google Gemini** (embeddings, enrichment, chat, classification) |
| Auth | Supabase Auth (email magic-link + JWT) |
| Encryption (Vault) | Browser-side AES-GCM with PBKDF2-derived key |
| Realtime sync | Supabase realtime (WebSocket) |
| Agent integration | Native MCP (Model Context Protocol) server |
| Public API | REST at `https://everion.smashburgerbar.co.za/v1/*` |

---

## 3. The 12 Serverless Functions (the entire backend)

Every API call routes through one of these. The 12-function cap is *hard* —
new actions get folded into existing handlers via `?resource=` or `?action=`
query params, never new files.

| Function | Responsibility |
|---|---|
| `capture` | Ingest a new entry; trigger background enrichment |
| `entries` | List / get / paginate entries |
| `update-entry` (under `entries`) | Patch title, content, type, tags, metadata |
| `delete-entry` (under `entries`) | Soft-delete |
| `search` | Semantic + lexical retrieval (vector + full-text) |
| `calendar` | Resolve scheduled entries into calendar events |
| `llm` | Chat / generation calls fan out to Gemini |
| `memory-api` | Personal memory bridge for external clients (curl-friendly) |
| `mcp` | MCP server endpoint for AI agents (Claude, Cursor, etc.) |
| `v1` | Public REST API: `/v1/ingest`, `/v1/context` |
| `transfer` | Import / export user data (portability) |
| `gmail` | Gmail OAuth + thread search + label management |
| `feedback` | User feedback into a shared inbox |
| `user-data` | Brains, settings, learning signals, profile |

---

## 4. Core Data Model

**One table to rule them all.**

```
entries
├─ id              uuid
├─ user_id         uuid     (RLS: user can only see their own rows)
├─ brain_id        uuid     (multi-context: work / personal / etc.)
├─ type            text     ('todo' | 'someday' | 'note' | 'secret' | 'event' | …)
├─ title           text
├─ content         text     (encrypted ciphertext when type='secret')
├─ tags            text[]
├─ metadata        jsonb    (dates, status, recurrence, importance, …)
├─ embedding       vector   (Gemini text-embedding-004, 768 dims)
├─ created_at      timestamptz
└─ updated_at      timestamptz
```

Plus: `brains`, `audit_log`, `user_usage`, `learning_decisions`,
`gmail_tokens`, `weekly_rollups`.

---

## 5. The Three Big Pipelines

### Pipeline A — Capture & Enrichment (write path)

```
User types/speaks → /api/capture
        │
        ├─→ Insert raw entry (type='note' default, status='unenriched')
        │   • UI shows it instantly (optimistic update)
        │
        └─→ Background enrich job (Gemini)
                │
                ├─→ Classify → set canonical `type`
                ├─→ Extract dates → metadata.scheduled_for / recurrence
                ├─→ Extract tags + summary
                ├─→ Generate embedding → entries.embedding
                └─→ Respect USER_OWNED_KEYS:
                    if user has edited a field, AI never overwrites it.
                    Marker: metadata.user_edited_at
```

**Critical design rule:** AI fills in *missing* fields, never clobbers
user-supplied ones. The `USER_OWNED_KEYS` set is the firewall.

### Pipeline B — Retrieval (read path)

```
User asks "what was that thing about X?" → /api/search
        │
        ├─→ Embed the query (Gemini)
        ├─→ Vector similarity against entries.embedding (Postgres pgvector)
        ├─→ Full-text fallback for low-confidence vector hits
        ├─→ Re-rank by recency × similarity × user feedback signals
        └─→ Return top-N with snippets

Same path is exposed publicly at /v1/context for external agents.
```

### Pipeline C — Placement (the "where does this todo show up?" engine)

A *single* function — `getPlacements(entry, options)` in
`src/views/todoUtils.ts` — answers every "should this entry appear here?"
question across the whole app.

```
Entry → getPlacements
    │
    ├─→ Action mode (TodoView list)
    │     • Specific date entries → today / overdue / future
    │     • Weekly recurrence (e.g. "every Wed") → match dow
    │     • Monthly recurrence (e.g. "1st of month") → match dom
    │     • Untyped someday → never appears
    │
    └─→ Calendar mode (week / month grid)
          • Same engine, range-filtered
          • One source of truth ⇒ no calendar/todo disagreement
```

The whole "Phase C" rewrite was: kill three competing placement engines, keep
one, prove it with 49 unit tests.

---

## 6. The Surface Area (what the user sees)

### Capture surfaces
- **Quick capture sheet** (mobile bottom-up, desktop top-anchored)
- **Voice note** with on-device transcription
- **Vault toggle** — encrypts before it ever leaves the device
- **Public capture endpoint** at `/v1/ingest` for shortcuts / third-party apps

### Retrieval surfaces
- **Search bar** — semantic + lexical, ranked
- **Ask box** — chat that grounds answers in your entries
- **Public context endpoint** at `/v1/context` for AI agents
- **MCP tools** — `retrieve_memory`, `create_entry` callable from any
  MCP-aware client

### Organisation surfaces
- **TodoView** with three tabs:
  - **Calendar** — week / month grids, drag-to-dismiss bottom sheet on mobile
  - **Actions** — today / overdue / upcoming, with one-tap done
  - **Someday** — GTD inbox with **user-managed category chips**
    (create / rename / delete / per-row picker)
- **Done today** pane — reversible completions with one-click reopen
- **Schedule inspector** (admin tool) — "why isn't X showing?" debug tracer

### Settings surfaces
- Brain switcher (work / personal contexts)
- Power-features flags (`VITE_FEATURE_*`)
- Encryption key management (Vault)
- Gmail connection
- Data export / import
- Audit log viewer

---

## 7. Feature → Pipeline Map

| Feature | Capture | Enrich | Retrieve | Place |
|---|:-:|:-:|:-:|:-:|
| Quick text note | ✓ | ✓ | ✓ | — |
| Voice memo | ✓ | ✓ | ✓ | — |
| Todo with date | ✓ | ✓ | ✓ | ✓ |
| Recurring todo | ✓ | ✓ | ✓ | ✓ |
| Someday/Maybe | ✓ | ✓ | ✓ | — |
| Encrypted secret | ✓ (client-side AES-GCM) | — (skipped) | ✓ (after unlock) | — |
| Calendar event | ✓ | ✓ | ✓ | ✓ |
| Gmail thread import | ✓ | ✓ | ✓ | — |

---

## 8. The Key Architectural Decisions

1. **One entries table, type discriminator** — instead of separate tables for
   todos / notes / secrets / events. Every entry can morph (someday → todo →
   done) by editing one column.

2. **JSONB metadata for everything date-shaped** — `scheduled_for`,
   `recurrence`, `due_date`, `event_date` all live in `metadata`. Schema
   stays stable; semantics evolve via convention.

3. **AI is a fill-in tool, not a source of truth** — user edits always win.
   The `USER_OWNED_KEYS` blacklist is the firewall.

4. **One placement engine** — `getPlacements()`. If calendar and todo list
   disagree, it's a single bug to fix in one place.

5. **12-function hard cap** — Vercel Hobby tier. Forces consolidation;
   prevents endpoint sprawl. New verbs become `?action=` params.

6. **Client-side encryption for secrets** — server never sees plaintext.
   Decryption happens in-browser with a PBKDF2-derived key the user holds.

7. **MCP-native** — agents can read and write your memory the same way
   the UI does. No separate "agent API" — same handlers, same RLS.

8. **localStorage for ephemeral org structure** — user-defined someday
   categories live in `localStorage` per brain. Cheap, instant, no schema
   migration. Sync across devices is the trade-off.

---

## 9. A Day In The Life

**Morning** — User opens the PWA. Recent captures load from cache, then the
service worker hydrates from `/api/entries`. TodoView shows today's items
(via `getPlacements`).

**Mid-morning** — Voice-capture: "remind me to call the supplier about the
new fryer next Tuesday at 10". Capture handler stores the raw text. Background
job fires:
- Gemini classifies → `type='todo'`
- Extracts → `metadata.scheduled_for = '2026-05-05'`, `metadata.event_time = '10:00'`
- Tags → `['suppliers', 'kitchen']`
- Embeds → 768-dim vector

**Lunchtime** — User asks "what was the thing about the fryer?" → search
embeds the query → vector hit on the captured item → answer surfaces with
snippet + link.

**Evening** — User reviews Someday tab, drags two items to "this week",
schedule action flips them to `type='todo'` with dates. They appear on
tomorrow's calendar.

**Anytime** — An external agent (Claude Desktop, Cursor, n8n) calls the MCP
server's `retrieve_memory` tool. Same auth, same RLS, same data — the agent
sees what the user sees, scoped to that user's brain.

---

## 10. How To Render This As An Infographic

For the NotebookLM infographic, organise the visual into **four quadrants**:

1. **Top-left — Capture surfaces** (text, voice, vault, public ingest, MCP)
   funnelling into a single `/api/capture` pipe.

2. **Top-right — The enrichment pipeline** (Gemini classify → extract dates
   → tag → embed) with a visible "USER_OWNED_KEYS firewall" gate.

3. **Bottom-left — The Postgres + pgvector store** at the centre, with the
   schema sketched (entries table dominant, satellites around it).

4. **Bottom-right — Retrieval and placement surfaces** (search, ask, todo,
   calendar, someday, MCP) all drawing from the same store via
   `getPlacements()` + vector search.

Across the middle, draw a horizontal band labelled **"12-function Vercel
edge — same handlers serve the UI, public API, and AI agents."**

Use:
- **Ember orange** (`#e8702a`-ish) for capture flows
- **Moss green** for done / completed states
- **Slate** for retrieval
- **Locked padlock icon** wherever Vault / encryption is involved
- **Robot icon** wherever AI / Gemini touches the data
