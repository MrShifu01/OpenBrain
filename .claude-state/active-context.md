# Active Context — 2026-04-03
**Branch:** main | **Enhancement:** standard | **Project:** OpenBrain

## Session Summary
Q&A and documentation session. Discussed Supabase RAG capabilities, embedding model options (OpenAI vs Google), and pricing. Created GAPS.md — a strategic analysis of what OpenBrain is missing to be world-class, covering E2EE/encryption architecture, AI intelligence gaps, product/UX, and infrastructure. The file was immediately cross-referenced against the approved embeddings spec and updated to remove the RAG gap (already in-flight).

## Built This Session
- `GAPS.md` — strategic gaps analysis (new file, root of OpenBrain project)

## Current State
- RAG implementation actively being built: `api/embed.js`, `api/search.js`, `api/_lib/generateEmbedding.js`, `supabase/migrations/008_pgvector.sql` — all untracked
- `GAPS.md` untracked, ready to commit
- `supabase/functions/test-secret.ts` untracked — unknown purpose, should be reviewed
- Phase 1 of per-task model selection complete and deployed
- Phase 2 + 3 of AI-models.md still incomplete (task: params + Settings UI)

## In-Flight Work
- RAG embeddings: `api/embed.js`, `api/search.js`, `api/_lib/generateEmbedding.js`, `supabase/migrations/008_pgvector.sql`
- AI-models.md Phase 2 + 3 — per previous next-steps.md

## Known Issues
- SuggestionsView.jsx ~line 168: image upload hardcoded to `authFetch("/api/anthropic")` — bypasses model routing
- All callAI() call sites missing `task:` param
- Critical security gaps: in-memory rate limiter, weak PIN, API key fallback — documented in GAPS.md

## Pipeline State
- **Last pipeline:** feature — 2026-04-03
- **Last scores:** composite 90/100
- **Open incidents:** none
