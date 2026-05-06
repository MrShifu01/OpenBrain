-- 070: entry_shares — share-overlay for multi-brain visibility.
--
-- An entry has a single owner brain (entries.brain_id) which controls edit /
-- delete / enrichment. entry_shares is a side table that lets the same
-- entry appear inside other brains the user has access to (read-only
-- overlay — no duplication, no separate enrichment, no separate cost).
--
-- Use case: a contact lives in My Brain but should also be visible in the
-- family or business brain. Edits in the source brain reflect everywhere.
-- Removing the share row hides it from the target brain without touching
-- the source.

CREATE TABLE IF NOT EXISTS public.entry_shares (
  entry_id        uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  target_brain_id uuid NOT NULL REFERENCES public.brains(id)  ON DELETE CASCADE,
  shared_by       uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  shared_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, target_brain_id)
);

CREATE INDEX IF NOT EXISTS entry_shares_target_brain_idx
  ON public.entry_shares (target_brain_id);
CREATE INDEX IF NOT EXISTS entry_shares_entry_idx
  ON public.entry_shares (entry_id);

ALTER TABLE public.entry_shares ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER predicate so entries_select can ask "is this entry
-- shared into a brain the caller can read?" without recursing back through
-- entries' own RLS. Mirrors the pattern from migration 069.
CREATE OR REPLACE FUNCTION public.is_entry_shared_to_user(eid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entry_shares es
    WHERE es.entry_id = eid
      AND (
        public.is_brain_owner(es.target_brain_id, uid)
        OR public.is_brain_member(es.target_brain_id, uid)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_entry_shared_to_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_entry_shared_to_user(uuid, uuid) TO authenticated;

-- Policies on entry_shares itself.
-- Read: caller can see a share row if they own/member the source entry's
-- brain, OR own/member the target brain.
CREATE POLICY entry_shares_select
  ON public.entry_shares FOR SELECT TO authenticated
  USING (
    public.is_brain_owner(target_brain_id, (SELECT auth.uid()))
    OR public.is_brain_member(target_brain_id, (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR public.is_brain_owner(e.brain_id, (SELECT auth.uid()))
          OR public.is_brain_member(e.brain_id, (SELECT auth.uid()))
        )
    )
  );

-- Insert: caller must own the source entry (or own the source brain) AND
-- have read access to the target brain. Stops cross-account share leaks.
CREATE POLICY entry_shares_insert
  ON public.entry_shares FOR INSERT TO authenticated
  WITH CHECK (
    shared_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR public.is_brain_owner(e.brain_id, (SELECT auth.uid()))
        )
    )
    AND (
      public.is_brain_owner(target_brain_id, (SELECT auth.uid()))
      OR public.is_brain_member(target_brain_id, (SELECT auth.uid()))
    )
  );

-- Delete: caller is the original sharer, owns the source entry's brain, or
-- owns the target brain (so a brain owner can revoke shares pushed in).
CREATE POLICY entry_shares_delete
  ON public.entry_shares FOR DELETE TO authenticated
  USING (
    shared_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = entry_id
        AND (
          e.user_id = (SELECT auth.uid())
          OR public.is_brain_owner(e.brain_id, (SELECT auth.uid()))
        )
    )
    OR public.is_brain_owner(target_brain_id, (SELECT auth.uid()))
  );

-- Extend entries_select so a caller can read entries that are shared into
-- a brain they have access to.
DROP POLICY IF EXISTS entries_select ON public.entries;
CREATE POLICY entries_select
  ON public.entries FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_brain_member(brain_id, (SELECT auth.uid()))
    OR public.is_brain_owner(brain_id, (SELECT auth.uid()))
    OR public.is_entry_shared_to_user(id, (SELECT auth.uid()))
  );
