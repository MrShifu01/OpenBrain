-- 054_delete_user_cascade.sql
-- Pre-launch RLS audit found that DELETE /auth/v1/admin/users/<id> only
-- removed the auth row — every public-schema row owned by that user was
-- left orphaned. Privacy Policy promises a full 48h scrub on account
-- deletion (POPIA / GDPR right of erasure), so the cascade has to happen
-- explicitly. There are no FK constraints from public.* to auth.users to
-- piggy-back on.
--
-- This migration adds a SECURITY DEFINER function the API can call once
-- before deleting the auth user. It deletes children-before-parents to
-- respect the intra-schema FKs that already exist.

CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_counts jsonb := '{}'::jsonb;
  v_n      integer;
BEGIN
  -- Entries: cascades to entry_tags, collection_entries, expiry_notification_log,
  -- idempotency_keys, and links via the existing intra-schema FK CASCADEs.
  DELETE FROM entries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('entries', v_n);

  -- Brains: cascades to brain_api_keys, concept_graphs, knowledge_shortcuts,
  -- messaging_connections, messaging_pending_links, query_feedback (all CASCADE
  -- on brain_id). Sets vault_entries.brain_id NULL — vault rows themselves are
  -- deleted in the next step.
  DELETE FROM brains WHERE owner_id = p_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('brains', v_n);

  -- Defense-in-depth: remove anything still keyed by user_id.
  DELETE FROM links                  WHERE user_id = p_user_id;
  DELETE FROM collections            WHERE user_id = p_user_id;
  DELETE FROM tags                   WHERE user_id = p_user_id;
  DELETE FROM vault_entries          WHERE user_id = p_user_id;
  DELETE FROM vault_keys             WHERE user_id = p_user_id;
  DELETE FROM audit_log              WHERE user_id = p_user_id;
  DELETE FROM user_memory            WHERE user_id = p_user_id;
  DELETE FROM user_ai_settings       WHERE user_id = p_user_id;
  DELETE FROM user_api_keys          WHERE user_id = p_user_id;
  DELETE FROM user_personas          WHERE user_id = p_user_id;
  DELETE FROM user_usage             WHERE user_id = p_user_id;
  DELETE FROM gmail_integrations     WHERE user_id = p_user_id;
  DELETE FROM calendar_integrations  WHERE user_id = p_user_id;
  DELETE FROM messaging_connections  WHERE user_id = p_user_id;
  DELETE FROM messaging_pending_links WHERE user_id = p_user_id;
  DELETE FROM notifications          WHERE user_id = p_user_id;
  DELETE FROM notification_prefs     WHERE user_id = p_user_id;
  DELETE FROM push_subscriptions     WHERE user_id = p_user_id;
  DELETE FROM expiry_notification_log WHERE user_id = p_user_id;
  DELETE FROM idempotency_keys       WHERE user_id = p_user_id;

  -- user_profiles uses id = auth.users.id (no separate user_id column)
  DELETE FROM user_profiles WHERE id = p_user_id;

  RETURN v_counts;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_user_data(uuid) TO service_role;
