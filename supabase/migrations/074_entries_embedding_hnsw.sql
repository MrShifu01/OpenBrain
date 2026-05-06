-- ============================================================
-- Migration 074: entries.embedding — switch ivfflat → HNSW
-- ============================================================
-- ivfflat index maintenance is noticeably worse than HNSW under
-- frequent UPDATE traffic. pg_stat_statements (2026-05-04) flagged
-- the embedding-write path as the top disk-I/O burner; HNSW also
-- gives better recall at our entry counts (low thousands), so this
-- is a one-way migration — ivfflat is removed once HNSW is live.
--
-- ── Why no CONCURRENTLY ─────────────────────────────────────────
-- apply_migration wraps the file in a transaction; CREATE INDEX
-- CONCURRENTLY can't run inside one. With our entry counts (low
-- thousands × 768 dims) the build completes in seconds, and the
-- crons are still disabled while the IO-budget incident recovers,
-- so a brief table lock during the build is acceptable.
--
-- If/when the table grows past ~50k rows, switch to a manual
-- dashboard-SQL-editor apply with CONCURRENTLY.

CREATE INDEX IF NOT EXISTS entries_embedding_hnsw_idx
  ON public.entries
  USING hnsw (embedding vector_cosine_ops);

-- Drop the old ivfflat. Both indexes can coexist briefly above; the
-- planner picks whichever has better cost. Once HNSW is live, ivfflat
-- is just dead weight on every INSERT/UPDATE.
DROP INDEX IF EXISTS public.entries_embedding_idx;

-- Refresh planner stats so match_entries / match_entries_for_user
-- pick up the new index immediately.
ANALYZE public.entries;
