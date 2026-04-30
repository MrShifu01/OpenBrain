-- 063_perf_rls_and_io.sql
-- Performance pass triggered by Supabase Disk IO Budget alert (2026-04-30).
-- pg_advisor flagged: 8 policies re-evaluating auth.uid() per row, 2 redundant
-- duplicate policies, 1 duplicate index, 2 unindexed foreign keys.
--
-- Scope is intentionally narrow — pure rewrites of existing semantics. No
-- table shape changes, no data movement. Application code requires no edits.
--
-- Out of scope (deferred): the ~25 "unused index" lints. pg_stat_user_indexes
-- counters reset on cluster restart, so a fresh "never used" reading on small
-- tables can be misleading. Revisit after a week of post-launch traffic.

-- ── 1. RLS init-plan rewrites ──────────────────────────────────────────────
-- Wrap auth.uid() in (SELECT ...) so Postgres hoists the function call out of
-- the per-row evaluation loop. Same semantics, lower CPU and far less cache
-- churn. See https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DROP POLICY IF EXISTS idempotency_keys_own ON public.idempotency_keys;
CREATE POLICY idempotency_keys_own ON public.idempotency_keys
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS audit_log_own ON public.audit_log;
CREATE POLICY audit_log_own ON public.audit_log
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_personas_owner_rw ON public.user_personas;
CREATE POLICY user_personas_owner_rw ON public.user_personas
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS gmail_decisions_owner_rw ON public.gmail_decisions;
CREATE POLICY gmail_decisions_owner_rw ON public.gmail_decisions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── 2. Drop redundant duplicate policies ───────────────────────────────────
-- "Multiple permissive policies" lint: every read/write evaluates *every*
-- applicable policy, so duplicates cost real CPU at scale. Both targets
-- below carry the same predicate as a sibling policy that is already
-- canonical-form, so dropping them is a pure simplification.

-- audit_log: legacy "users read own audit log" duplicates audit_log_own (just
-- rewritten above). Same predicate, broader role grant — squash to one.
DROP POLICY IF EXISTS "users read own audit log" ON public.audit_log;

-- brains: brains_owner_all is a legacy FOR ALL catch-all that overlaps with
-- the granular brains_select / brains_insert / brains_update / brains_delete
-- policies (which already use the correct (SELECT auth.uid()) form).
DROP POLICY IF EXISTS brains_owner_all ON public.brains;

-- ── 3. Covering indexes for unindexed foreign keys ────────────────────────
-- Without a covering index, every UPDATE/DELETE on the parent table forces a
-- sequential scan of the child to verify referential integrity. Tiny tables
-- now, but this is the kind of trap that quietly bills hours of Disk IO once
-- volume picks up.

CREATE INDEX IF NOT EXISTS idempotency_keys_entry_id_idx
  ON public.idempotency_keys (entry_id)
  WHERE entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_ai_settings_active_brain_id_idx
  ON public.user_ai_settings (active_brain_id)
  WHERE active_brain_id IS NOT NULL;

-- ── 4. Drop duplicate index ────────────────────────────────────────────────
-- audit_log_user_idx and audit_log_user_id_timestamp_idx are byte-for-byte
-- identical: both btree(user_id, "timestamp" DESC). Every audit insert
-- writes both. Keep the more descriptively named one.

DROP INDEX IF EXISTS public.audit_log_user_idx;
