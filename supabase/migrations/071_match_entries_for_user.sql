-- 071: match_entries_for_user — vector retrieval scoped to every brain a
-- user can read.
--
-- The original match_entries(query_embedding, p_brain_id, match_count) is
-- still used by the API-key-scoped endpoints (v1, memory-api, mcp) where
-- the caller picks one brain. /api/llm chat instead wants "all my
-- brains" — owned brains, brains where I'm a member/viewer, plus
-- entries shared into any of those via entry_shares (migration 070).
--
-- Resolved entirely inside the function so callers don't need to fetch
-- the brain list separately. SECURITY DEFINER + an explicit search_path
-- including 'extensions' so the vector <=> operator resolves and RLS
-- doesn't block the brains/brain_members/entry_shares lookups.

CREATE OR REPLACE FUNCTION public.match_entries_for_user(
  query_embedding vector,
  p_user_id uuid,
  match_count integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  type text,
  tags text[],
  metadata jsonb,
  brain_id uuid,
  created_at timestamptz,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
  WITH accessible_brains AS (
    SELECT id FROM public.brains WHERE owner_id = p_user_id
    UNION
    SELECT brain_id FROM public.brain_members WHERE user_id = p_user_id
  )
  SELECT
    e.id,
    e.title,
    e.content,
    e.type,
    e.tags,
    e.metadata,
    e.brain_id,
    e.created_at,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.entries e
  WHERE e.embedding IS NOT NULL
    AND e.deleted_at IS NULL
    AND e.type IS DISTINCT FROM 'secret'
    AND (
      e.brain_id IN (SELECT id FROM accessible_brains)
      OR e.id IN (
        SELECT es.entry_id FROM public.entry_shares es
        WHERE es.target_brain_id IN (SELECT id FROM accessible_brains)
      )
    )
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_entries_for_user(vector, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_entries_for_user(vector, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_entries_for_user(vector, uuid, integer) TO service_role;
