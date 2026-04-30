-- 066_admin_crm.sql
--
-- Internal support CRM scaffolding. The actual table data already lives in
-- user_profiles (tier + billing), user_usage (per-month counters), and
-- audit_log (event timeline) — this migration just adds:
--   1. an index on user_profiles(tier) so the admin filter doesn't scan,
--   2. an admin_list_users RPC that joins user_profiles ↔ auth.users so the
--      handler doesn't need to round-trip the auth admin REST endpoint,
--   3. an admin_user_overview RPC that returns the three sections the
--      detail panel renders in one call.
--
-- Both RPCs are SECURITY DEFINER, callable only by the service_role. The
-- API layer (api/user-data.ts) checks the caller's JWT for is_admin before
-- invoking them.

CREATE INDEX IF NOT EXISTS user_profiles_tier_idx
  ON public.user_profiles (tier);

-- Search by email substring or id prefix. Empty/null query returns the most
-- recently created users so opening the console shows the freshest signups.
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_q      text DEFAULT NULL,
  p_limit  int  DEFAULT 25,
  p_offset int  DEFAULT 0
) RETURNS TABLE (
  id                  uuid,
  email               text,
  tier                text,
  billing_provider    text,
  current_period_end  timestamptz,
  created_at          timestamptz,
  last_sign_in_at     timestamptz
) LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.tier, 'free') AS tier,
    p.billing_provider,
    p.current_period_end,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  WHERE
    p_q IS NULL
    OR p_q = ''
    OR u.email ILIKE '%' || p_q || '%'
    OR u.id::text ILIKE p_q || '%'
  ORDER BY u.created_at DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1)
  OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users(text, int, int) FROM anon;
REVOKE ALL ON FUNCTION public.admin_list_users(text, int, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, int, int) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_user_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_profile jsonb;
  v_usage   jsonb;
  v_audit   jsonb;
  v_period  text := to_char((now() AT TIME ZONE 'UTC')::date, 'YYYY-MM');
BEGIN
  SELECT to_jsonb(t) INTO v_profile FROM (
    SELECT
      u.id,
      u.email::text                         AS email,
      u.created_at                          AS auth_created_at,
      u.last_sign_in_at,
      COALESCE(p.tier, 'free')              AS tier,
      p.billing_provider,
      p.current_period_end,
      p.tier_expires_at,
      p.lemonsqueezy_customer_id,
      p.lemonsqueezy_subscription_id,
      p.appstore_original_transaction_id,
      p.playstore_purchase_token,
      p.playstore_product_id,
      p.created_at                          AS profile_created_at,
      p.updated_at                          AS profile_updated_at
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id = u.id
    WHERE u.id = p_user_id
  ) t;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('error', 'user not found');
  END IF;

  SELECT to_jsonb(t) INTO v_usage FROM (
    SELECT
      period,
      captures,
      chats,
      voice,
      improve
    FROM public.user_usage
    WHERE user_id = p_user_id AND period = v_period
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a."timestamp" DESC), '[]'::jsonb) INTO v_audit
  FROM (
    SELECT id, action, resource_id, "timestamp", metadata
    FROM public.audit_log
    WHERE user_id = p_user_id
    ORDER BY "timestamp" DESC
    LIMIT 50
  ) a;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'usage_period', v_period,
    'usage', v_usage,
    'audit', v_audit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_overview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_user_overview(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_user_overview(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_overview(uuid) TO service_role;
