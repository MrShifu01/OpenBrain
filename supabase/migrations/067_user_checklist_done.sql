-- 067: user_checklist_done — cross-device first-run checklist persistence
--
-- Replaces the old localStorage `everion_home_checklist_done_v1` bag with a
-- proper DB row so completion sticks across devices. One row per (user, item).
-- Composite PK keeps re-pins idempotent — the client can fire "I just saw
-- vault go true" repeatedly and the server upserts without dupes.
--
-- item_id is a free-form string (e.g. "capture5", "persona", "gmail",
-- "calendar", "vault", "brain"). No enum — adding a new checklist item should
-- not require a migration.

CREATE TABLE IF NOT EXISTS public.user_checklist_done (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id      text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.user_checklist_done ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_checklist_done_all ON public.user_checklist_done;
CREATE POLICY user_checklist_done_all
  ON public.user_checklist_done
  FOR ALL TO authenticated
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.user_checklist_done IS
  'Cross-device sticky-done flags for the home first-run checklist. One row per (user, item). Once written, an item stays done forever.';
