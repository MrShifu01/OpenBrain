-- 075: brain_notification_prefs — per-(user, brain) notification level
--
-- See EML/Specs/shared-brain-notifications.md for the design.
--
-- A row with level='all' means the user wants every reminder for that brain.
-- 'owner_only' means only fire if the user is the brain owner. 'off' silences
-- the brain. Missing row = default to 'all' (opted in).

CREATE TABLE IF NOT EXISTS public.brain_notification_prefs (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brain_id   uuid NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE,
  level      text NOT NULL CHECK (level IN ('all', 'owner_only', 'off')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, brain_id)
);

-- Reverse lookup: "what brains has this user customised" — used by the
-- Settings → Notifications UI to render the per-brain toggles.
CREATE INDEX IF NOT EXISTS brain_notif_prefs_user_idx
  ON public.brain_notification_prefs (user_id);

ALTER TABLE public.brain_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bnp_select ON public.brain_notification_prefs;
CREATE POLICY bnp_select
  ON public.brain_notification_prefs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS bnp_upsert ON public.brain_notification_prefs;
CREATE POLICY bnp_upsert
  ON public.brain_notification_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS bnp_update ON public.brain_notification_prefs;
CREATE POLICY bnp_update
  ON public.brain_notification_prefs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS bnp_delete ON public.brain_notification_prefs;
CREATE POLICY bnp_delete
  ON public.brain_notification_prefs FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
