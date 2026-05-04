-- ============================================================
-- Migration 074: entries.embedding — switch ivfflat → HNSW
-- ============================================================
-- ivfflat index maintenance is noticeably worse than HNSW under
-- frequent UPDATE traffic. pg_stat_statements (2026-05-04) flagged
-- the embedding-write path as the top disk-I/O burner; HNSW also
-- gives better recall at our entry counts (low thousands), so this
-- is a one-way migration — ivfflat is removed once HNSW is live.
--
-- ── Apply notes ─────────────────────────────────────────────────
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction. Two
-- options:
--   (a) Run via the Supabase Dashboard SQL editor — each statement
--       executes outside a transaction by default. Recommended.
--   (b) Run via psql with autocommit (\set AUTOCOMMIT on).
-- The DROP at the end is in the same script for clarity but it WILL
-- run inside a transaction safely on its own. If your migration
-- runner wraps the file in BEGIN/COMMIT, split into two files
-- before applying.

CREATE INDEX CONCURRENTLY IF NOT EXISTS entries_embedding_hnsw_idx
  ON public.entries
  USING hnsw (embedding vector_cosine_ops);

-- ANALYZE so the planner picks up the new index immediately.
ANALYZE public.entries;

-- Drop the old ivfflat. Safe to do AFTER the HNSW build completes —
-- match_entries / match_entries_for_user use the index implicitly via
-- the <=> operator and will switch to whichever index the planner
-- prefers; with HNSW present it will be the new one.
DROP INDEX IF EXISTS public.entries_embedding_idx;
