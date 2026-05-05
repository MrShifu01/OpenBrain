-- 079: Lock down vault_entries cross-brain visibility at the DB layer.
--
-- Previously: brain_id was nullable and RLS only checked auth.uid() = user_id.
-- A NULL brain_id row would never appear in any brain's view (server filter
-- excludes NULL), but if a buggy client inserted one it'd be invisible
-- forever. Worse, the user_id-only RLS meant any user could direct-query
-- vault_entries without a brain filter and pull every secret across every
-- brain they own — UI scoping was the only line of defence.
--
-- This migration adds three guarantees:
--   1. brain_id NOT NULL — every vault row must declare a brain.
--   2. RLS requires the row's brain_id be one the caller owns or is a
--      member of, in addition to user_id ownership.
--   3. INSERT/UPDATE WITH CHECK enforces (1) and (2) at write time.
--
-- A pre-flight count confirmed there are 0 NULL-brain rows on the live DB
-- as of 2026-05-05, so no backfill is needed before adding NOT NULL. If a
-- future env has NULL rows, run this backfill first:
--   UPDATE vault_entries SET brain_id = (
--     SELECT id FROM brains WHERE owner_id = vault_entries.user_id
--       AND is_personal = true LIMIT 1
--   ) WHERE brain_id IS NULL;

-- 1. NOT NULL on brain_id. The FK is already there (REFERENCES brains(id)
--    ON DELETE SET NULL) but ON DELETE SET NULL contradicts NOT NULL — so
--    swap the FK to ON DELETE CASCADE. If a brain is deleted, every secret
--    in it is dropped along with it (consistent with how entries' brain_id
--    cascades). vault_keys + brain_vault_grants are unaffected.
ALTER TABLE public.vault_entries
  DROP CONSTRAINT IF EXISTS vault_entries_brain_id_fkey;

ALTER TABLE public.vault_entries
  ALTER COLUMN brain_id SET NOT NULL;

ALTER TABLE public.vault_entries
  ADD CONSTRAINT vault_entries_brain_id_fkey
  FOREIGN KEY (brain_id) REFERENCES public.brains(id) ON DELETE CASCADE;

-- 2. Replace the user_id-only policy with a stricter one. Caller must own
--    the row AND have access to the brain (owner or member). This prevents
--    a user with multiple brains from direct-querying vault_entries and
--    seeing rows from a brain they were just removed from.
DROP POLICY IF EXISTS "Users manage own vault entries" ON public.vault_entries;

CREATE POLICY vault_entries_select
  ON public.vault_entries FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      public.is_brain_owner(brain_id, (SELECT auth.uid()))
      OR public.is_brain_member(brain_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY vault_entries_insert
  ON public.vault_entries FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND brain_id IS NOT NULL
    AND (
      public.is_brain_owner(brain_id, (SELECT auth.uid()))
      OR public.is_brain_member(brain_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY vault_entries_update
  ON public.vault_entries FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      public.is_brain_owner(brain_id, (SELECT auth.uid()))
      OR public.is_brain_member(brain_id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND brain_id IS NOT NULL
    AND (
      public.is_brain_owner(brain_id, (SELECT auth.uid()))
      OR public.is_brain_member(brain_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY vault_entries_delete
  ON public.vault_entries FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      public.is_brain_owner(brain_id, (SELECT auth.uid()))
      OR public.is_brain_member(brain_id, (SELECT auth.uid()))
    )
  );
