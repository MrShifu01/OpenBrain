-- 069: Fix infinite-recursion in 068's RLS policies
--
-- 068 introduced cross-table RLS:
--   brains.brains_select       checks brain_members (am I a member?)
--   brain_members.brain_members_select checks brains   (am I the owner?)
-- Each recursive lookup re-applied RLS on the other table → "infinite
-- recursion detected in policy for relation" error on every SELECT.
--
-- Same problem existed in entries_select / entries_insert which referenced
-- both brains and brain_members.
--
-- Fix: SECURITY DEFINER helper functions that bypass RLS for the cross-
-- table existence checks. is_brain_owner and is_brain_member are pure
-- existence predicates with `SET search_path = public` so they're safe
-- to grant to authenticated.

CREATE OR REPLACE FUNCTION public.is_brain_owner(bid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.brains WHERE id = bid AND owner_id = uid);
$$;

CREATE OR REPLACE FUNCTION public.is_brain_member(bid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.brain_members WHERE brain_id = bid AND user_id = uid);
$$;

CREATE OR REPLACE FUNCTION public.is_brain_member_with_role(bid uuid, uid uuid, want_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brain_members
    WHERE brain_id = bid AND user_id = uid AND role = want_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_brain_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_brain_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_brain_member_with_role(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_brain_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_brain_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_brain_member_with_role(uuid, uuid, text) TO authenticated;

-- Replace the recursive policies.
DROP POLICY IF EXISTS brain_members_select ON public.brain_members;
CREATE POLICY brain_members_select
  ON public.brain_members FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_brain_owner(brain_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS brain_invites_select ON public.brain_invites;
CREATE POLICY brain_invites_select
  ON public.brain_invites FOR SELECT TO authenticated
  USING (public.is_brain_owner(brain_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS brains_select ON public.brains;
CREATE POLICY brains_select
  ON public.brains FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.is_brain_member(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS entries_select ON public.entries;
CREATE POLICY entries_select
  ON public.entries FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_brain_member(brain_id, (SELECT auth.uid()))
    OR public.is_brain_owner(brain_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS entries_insert ON public.entries;
CREATE POLICY entries_insert
  ON public.entries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      public.is_brain_owner(brain_id, (SELECT auth.uid()))
      OR public.is_brain_member_with_role(brain_id, (SELECT auth.uid()), 'member')
    )
  );

DROP POLICY IF EXISTS entries_delete ON public.entries;
CREATE POLICY entries_delete
  ON public.entries FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_brain_owner(brain_id, (SELECT auth.uid()))
  );
