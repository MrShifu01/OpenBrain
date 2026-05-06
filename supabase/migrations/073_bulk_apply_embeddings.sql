-- ============================================================
-- Migration 073: bulk_apply_embeddings RPC
-- ============================================================
-- Replaces the cron's per-row PATCH /entries pattern with a single
-- UPDATE ... FROM per chunk. Without this, enrichBrain does N serial
-- PostgREST PATCHes per fire — N transactions, N heap dirties,
-- N pgvector index updates, N WAL records. pg_stat_statements named
-- this as the #1 disk-write contributor (3645 calls / 897 shared
-- blocks written) on 2026-05-04.
--
-- Caller passes a JSONB array shaped:
--   [{
--     id, embedding, embedded_at,
--     embedding_provider, embedding_model, embedding_status
--   }, ...]
--
-- Manual casts via jsonb_array_elements (not jsonb_to_recordset) so
-- vector(768) parsing is explicit and nullability is unambiguous.
-- search_path is locked to public+extensions+pg_temp so the SECURITY
-- DEFINER context can't be hijacked by a shadowing object in another
-- schema.

CREATE OR REPLACE FUNCTION public.bulk_apply_embeddings(rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF rows IS NULL OR jsonb_typeof(rows) <> 'array' THEN
    RAISE EXCEPTION 'bulk_apply_embeddings: rows must be a JSON array';
  END IF;

  WITH s AS (
    SELECT
      (r->>'id')::uuid                          AS id,
      (r->>'embedding')::vector(768)            AS embedding,
      (r->>'embedded_at')::timestamptz          AS embedded_at,
      r->>'embedding_provider'                  AS embedding_provider,
      r->>'embedding_model'                     AS embedding_model,
      COALESCE(r->>'embedding_status', 'done')  AS embedding_status
    FROM jsonb_array_elements(rows) AS r
  )
  UPDATE public.entries e
  SET
    embedding          = s.embedding,
    embedded_at        = s.embedded_at,
    embedding_provider = s.embedding_provider,
    embedding_model    = s.embedding_model,
    embedding_status   = s.embedding_status
  FROM s
  WHERE e.id = s.id
    AND e.deleted_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- The function bypasses RLS via DEFINER, so don't expose to anon. The
-- only legitimate caller is the Vercel cron path which authenticates
-- with the service role key.
REVOKE ALL ON FUNCTION public.bulk_apply_embeddings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_apply_embeddings(jsonb) TO service_role;

COMMENT ON FUNCTION public.bulk_apply_embeddings(jsonb) IS
  'Bulk-apply embedding rows in a single UPDATE ... FROM. Cron-only — '
  'service_role caller. Replaces per-row PostgREST PATCHes during '
  'enrichBrain to cut WAL/heap/index churn (see migration 073).';
