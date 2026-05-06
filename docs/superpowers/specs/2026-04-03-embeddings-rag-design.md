# OpenBrain: Embeddings + RAG Design

**Date:** 2026-04-03  
**Status:** Approved — implement directly

---

## Goal

Replace keyword-only search and dumb top-100 chat context with semantic embeddings + retrieval-augmented generation (RAG). Every AI feature in the app — search, chat, connection finding, duplicate detection — gets smarter from a single pgvector column.

---

## Embedding Providers

Two supported providers, selectable in Settings:

| Provider | Model                                             | Dimensions |
| -------- | ------------------------------------------------- | ---------- |
| OpenAI   | `text-embedding-3-small` (with `dimensions: 768`) | 768        |
| Google   | `text-embedding-004`                              | 768        |

Both use 768 dimensions so they share the same `vector(768)` column. OpenAI's model natively supports dimension reduction via the `dimensions` parameter — quality loss is negligible. Google's model is natively 768.

A `embedding_provider text` column tracks which model generated the current embedding. If the user switches providers, the batch backfill re-embeds only the stale entries.

Embedding features degrade gracefully: users with no embedding key fall back to existing keyword search and top-100 chat context. Zero regression.

---

## Section 1: Database

**Migration `008_pgvector.sql`:**

1. Enable `pgvector` extension
2. Add `embedding vector(768)` to `entries`
3. Add `embedded_at timestamptz` — null means not yet embedded
4. Add `embedding_provider text` — tracks which model generated the embedding
5. Create IVFFlat index with `vector_cosine_ops` for fast approximate nearest-neighbor search
6. Create `match_entries(query_embedding vector(768), p_brain_id uuid, match_count int)` SQL function — returns entries ordered by cosine similarity, brain-scoped

The `match_entries` function is the sole pgvector interface. All callers (search, chat, connection finder) go through it — no raw `<=>` operators scattered across the codebase.

---

## Section 2: Embedding Generation Pipeline

### `api/embed.js` (new)

Two modes via request body:

**Single entry:**

```
POST /api/embed
{ entry_id: "uuid" }
```

Embeds one entry. Called fire-and-forget from capture and update handlers.

**Batch backfill:**

```
POST /api/embed
{ brain_id: "uuid", batch: true }
```

Processes all entries in the brain where `embedded_at IS NULL` OR `embedding_provider != current_provider`. Chunks of 50, small delay between chunks to respect rate limits. Returns `{ processed: N, skipped: M }`.

### `api/capture.js` (modified)

After the existing audit log fire-and-forget (line 82), add a third fire-and-forget:

```js
fetch("/api/embed", { method: "POST", body: JSON.stringify({ entry_id: data.id }), ... }).catch(() => {});
```

Non-blocking. Same pattern as audit log. Capture response time is unaffected.

### `api/update-entry.js` (modified)

Same fire-and-forget embed call after successful update. Content changes invalidate the previous embedding.

### Settings UI (modified — `SettingsView.jsx`)

New "Embedding" section:

- Toggle: OpenAI / Google
- Key field: shown conditionally (Gemini API key for Google; OpenAI key already exists)
- Button: "Re-embed all entries" → triggers `POST /api/embed { brain_id, batch: true }`
- Status indicator: shows how many entries are embedded vs. total

---

## Section 3: Semantic Search

### `api/search.js` (new)

```
POST /api/search
{ query: string, brain_id: uuid, limit: 20 }
```

1. Embed the query using the user's configured embedding provider
2. Call `match_entries` — returns entries ranked by cosine similarity
3. Return ranked entries

Returns `null` body (or 400) if no embedding key configured — client falls back to keyword index.

### Client (`OpenBrain.jsx`)

Search input already debounced and wired to `searchIndex`. New flow:

```
embedding key configured?
  yes → POST /api/search → ranked results
  no  → existing searchIndex (keyword, client-side, unchanged)
```

Transparent to UI — same input, same results list component.

### Connection Finder (`connectionFinder.js`)

Currently: passes 50 random entries to LLM.  
New: pre-filter to top-20 by cosine similarity via `POST /api/search` before the LLM call.  
Fallback: random-50 when no embeddings available.  
Result: 60% smaller LLM prompt, dramatically more relevant connections.

### Duplicate Detection (`duplicateDetection.js`)

Currently: word-overlap `scoreTitle()`.  
Add: cosine similarity check — entries scoring ≥ 0.92 flagged as likely duplicate.  
Runs alongside existing check, does not replace it.

---

## Section 4: RAG-Powered Chat

### `api/chat.js` (new)

```
POST /api/chat
{ message: string, brain_id: uuid, history: Message[] }
```

Pipeline:

1. Embed `message` using user's embedding provider
2. `match_entries` → top-20 semantically relevant entries
3. Fetch links for those 20 entries only
4. Call LLM with: system prompt + retrieved entries as context + conversation history + user message
5. Return `{ content: string, sources: uuid[] }` — source IDs allow client to highlight which entries informed the answer

### Conversation History

- Client sends last 10 turns (5 user + 5 assistant) from `chatMsgs` state
- No server-side session storage — client owns history
- `chatMsgs` state in `OpenBrain.jsx` is unchanged; it's already accumulated, just wasn't being sent

### Client (`OpenBrain.jsx`)

`handleChat` currently calls `callAI` with `chatContext` (top-100 slice).  
New flow:

```
embedding key configured?
  yes → POST /api/chat (RAG + history)
  no  → callAI directly with top-100 slice (current behavior)
```

---

## Data Flow Summary

```
Capture/Update
  → fire-and-forget → /api/embed → OpenAI/Google → vector stored in entries.embedding

Search query
  → /api/search → embed query → match_entries (pgvector) → ranked results

Chat message
  → /api/chat → embed message → match_entries → top-20 entries + history → LLM → answer

Connection finder
  → /api/search (pre-filter) → top-20 candidates → LLM (smaller prompt) → links

Duplicate detection
  → cosine similarity (≥0.92) + existing word-overlap → combined score
```

---

## What Does NOT Change

- Existing keyword search (`searchIndex.js`) — kept as fallback
- `callAI` routing (Anthropic/OpenAI/OpenRouter for generation) — untouched
- `chatMsgs` state shape — unchanged
- All existing API endpoints — additive changes only to `capture.js` and `update-entry.js`
- RLS policies — `match_entries` is brain-scoped, inherits existing security model
- Offline behavior — embedding is server-side only; offline mode falls back to keyword search
