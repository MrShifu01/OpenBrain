-- 053_rls_audit_hardening.sql
-- Closes findings from the pre-launch RLS audit (2026-04-27).
--
-- 1. recall() and link_entries() were legacy MCP-server helpers with a
--    hard-coded user_id (Christian's). With anon EXECUTE granted, any
--    visitor calling /rest/v1/rpc/recall would dump that user's entries.
--    Both are unreferenced in the codebase. Drop them.
-- 2. increment_usage() is only called server-side via service_role. Revoke
--    EXECUTE from anon/authenticated so a malicious caller can't pass an
--    arbitrary p_user_id and burn another user's quota.
-- 3. Trigger-only functions (create_user_profile, create_personal_brain_for_new_user,
--    sync_plan_to_ai_settings, rls_auto_enable) cannot be invoked via PostgREST
--    anyway, but defense-in-depth: revoke EXECUTE from anon/authenticated.
-- 4. user_personas policy was scoped to role `public` (which includes anon).
--    auth.uid() = user_id keeps anon out, but tighten to `authenticated` so
--    the policy is unambiguous.

DROP FUNCTION IF EXISTS public.recall(text, text, boolean, integer);
DROP FUNCTION IF EXISTS public.link_entries(uuid, uuid, text);

REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_usage(uuid, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_user_profile()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_personal_brain_for_new_user()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_plan_to_ai_settings()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                       FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS user_personas_owner_rw ON public.user_personas;
CREATE POLICY user_personas_owner_rw ON public.user_personas
  FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
