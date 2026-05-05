-- ============================================================
-- Migration 077: Fix signup trigger — restore execute grant + exception safety
-- ============================================================
-- Production-blocking incident on 2026-05-05: every signup returns
-- "Database error creating new user" (HTTP 500). Repro:
--
--   curl -X POST "$SB/auth/v1/admin/users" -H "apikey: $SR_KEY" \
--     -H "Authorization: Bearer $SR_KEY" -H "Content-Type: application/json" \
--     -d '{"email":"x@y.test","password":"abc-1234567","email_confirm":true}'
--   → 500 {"error_code":"unexpected_failure","msg":"Database error creating new user"}
--
-- Two latent regressions converged:
--
-- (1) Migration 053 ran:
--       REVOKE EXECUTE ON FUNCTION public.create_user_profile() FROM PUBLIC, anon, authenticated;
--     This stripped the implicit PUBLIC grant. Supabase Auth fires the
--     on_auth_user_created trigger as the supabase_auth_admin role, which
--     inherited execute-on-public-functions through PUBLIC. With that
--     gone, the trigger's CALL fails with "permission denied for function"
--     → AFTER-INSERT trigger raises → auth.users INSERT rolls back → the
--     auth API sees a generic 500 and returns "Database error".
--
-- (2) Migrations 031 + 060 dropped the EXCEPTION WHEN OTHERS block that
--     migration 017 had added to the auto-provision trigger. So even if
--     the permissions were correct, any failure inside the function (a
--     CHECK constraint added later, an RLS edge case, a typo on a column
--     rename) now hard-blocks signup instead of degrading gracefully.
--
-- Fix:
--   • Replace the trigger with a single combined handler that creates BOTH
--     the user_profiles row AND the personal brain. Each step in its own
--     BEGIN/EXCEPTION/END so a failure in one logs a warning but lets the
--     other still run, and signup itself is never blocked.
--   • Re-grant EXECUTE on every trigger function that's currently wired or
--     could plausibly be wired to supabase_auth_admin. Defense in depth:
--     we also keep the legacy single-purpose functions executable in case
--     a future migration re-wires them.
-- ============================================================

-- 1. Single combined handler. Mirrors the responsibilities split across
--    create_user_profile() + create_personal_brain_for_new_user(), with
--    per-step exception isolation so partial failures don't compound.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.user_profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: user_profiles insert failed for %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  BEGIN
    INSERT INTO public.brains (name, owner_id, is_personal)
    SELECT 'My Brain', NEW.id, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.brains
      WHERE owner_id = NEW.id AND is_personal = true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: brain creation failed for %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- 2. Re-wire the trigger to use the combined handler.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Restore the missing EXECUTE grant. supabase_auth_admin is the role
--    Postgres uses when Supabase Auth fires the AFTER-INSERT trigger; it
--    must be able to invoke the trigger function or the whole signup
--    transaction rolls back.
GRANT EXECUTE ON FUNCTION public.handle_new_user()                       TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.create_user_profile()                   TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.create_personal_brain_for_new_user()    TO supabase_auth_admin;
