-- 062: important_memories table
--
-- User-curated durable facts Everion will always trust. Promoted from regular
-- entries via the "Keep this" action. v0 is user-curated only — no AI inference,
-- no contradiction detection, no automatic reconciliation. Those land
-- post-launch (see LAUNCH_CHECKLIST.md).
--
-- Status flow: active → retired (soft delete via `retired_at`). Retired
-- memories are kept for audit but excluded from retrieval.
--
-- memory_key is a deterministic slug derived from type + title (e.g.
-- "fact:wifi_password_for_studio"). Unique-active constraint prevents
-- duplicate active memories with the same key in the same brain.

CREATE TABLE IF NOT EXISTS public.important_memories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id          uuid NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_key        text NOT NULL,
  title             text NOT NULL,
  summary           text NOT NULL,
  memory_type       text NOT NULL DEFAULT 'fact',
  source_entry_ids  uuid[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'active',
  created_by        text NOT NULL DEFAULT 'user',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  retired_at        timestamptz,

  CONSTRAINT important_memories_status_check
    CHECK (status IN ('active', 'retired')),
  CONSTRAINT important_memories_type_check
    CHECK (memory_type IN ('fact', 'preference', 'decision', 'obligation')),
  CONSTRAINT important_memories_created_by_check
    CHECK (created_by IN ('user', 'system'))
);

-- One active memory per (brain, key). Retired rows are not constrained, so a
-- user can retire and re-create.
CREATE UNIQUE INDEX IF NOT EXISTS important_memories_active_key_uidx
  ON public.important_memories (brain_id, memory_key)
  WHERE status = 'active';

-- Per-brain listing — order by recency.
CREATE INDEX IF NOT EXISTS important_memories_brain_created_idx
  ON public.important_memories (brain_id, created_at DESC);

-- Per-user listing (cross-brain) — order by recency.
CREATE INDEX IF NOT EXISTS important_memories_user_created_idx
  ON public.important_memories (user_id, created_at DESC);

-- Reverse lookup: "what memories cite this entry" — used when an entry is
-- deleted to clean up source_entry_ids references.
CREATE INDEX IF NOT EXISTS important_memories_source_entry_ids_gin
  ON public.important_memories USING gin (source_entry_ids);

ALTER TABLE public.important_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS important_memories_all ON public.important_memories;
CREATE POLICY important_memories_all
  ON public.important_memories
  FOR ALL TO authenticated
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Auto-update `updated_at` on row change. Reuses the trigger function from
-- migration 000 (set_updated_at) — fall back to inline if missing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    EXECUTE 'CREATE TRIGGER important_memories_set_updated_at
             BEFORE UPDATE ON public.important_memories
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  ELSE
    EXECUTE 'CREATE OR REPLACE FUNCTION public.important_memories_touch()
             RETURNS trigger LANGUAGE plpgsql AS $f$
             BEGIN
               NEW.updated_at = now();
               RETURN NEW;
             END $f$';
    EXECUTE 'CREATE TRIGGER important_memories_set_updated_at
             BEFORE UPDATE ON public.important_memories
             FOR EACH ROW EXECUTE FUNCTION public.important_memories_touch()';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.important_memories IS
  'User-curated durable facts Everion always trusts. v0 = user-curated only (no AI inference). Soft-deletes via status=retired. memory_key is deterministic from type + title.';
