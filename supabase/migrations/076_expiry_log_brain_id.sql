-- 076: expiry_notification_log — add brain_id, replace unique key
--
-- The per-(member, entry) reminder dedup needs to also consider the brain
-- the entry was reached through. See EML/Specs/shared-brain-notifications.md.
--
-- Existing rows have brain_id IS NULL — that's fine. PostgreSQL treats NULL
-- as distinct in a UNIQUE constraint, so historical rows don't collide with
-- new fan-out rows that always carry a brain_id.

ALTER TABLE public.expiry_notification_log
  ADD COLUMN IF NOT EXISTS brain_id uuid REFERENCES public.brains(id) ON DELETE CASCADE;

-- Drop the old (user_id, entry_id, item_label, lead_days) unique constraint
-- if it exists. Constraint name follows Postgres' auto-generated convention
-- from migration 004; defensive in case the install-time name differs.
DO $$
DECLARE
  cn text;
BEGIN
  SELECT conname INTO cn
  FROM pg_constraint
  WHERE conrelid = 'public.expiry_notification_log'::regclass
    AND contype = 'u'
    AND conname LIKE 'expiry_notification_log_user_id_entry_id_item_label_lead_d%';
  IF cn IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.expiry_notification_log DROP CONSTRAINT %I', cn);
  END IF;
END $$;

ALTER TABLE public.expiry_notification_log
  DROP CONSTRAINT IF EXISTS expiry_log_user_entry_brain_lead_uniq;
ALTER TABLE public.expiry_notification_log
  ADD CONSTRAINT expiry_log_user_entry_brain_lead_uniq
  UNIQUE (user_id, entry_id, brain_id, lead_days);

CREATE INDEX IF NOT EXISTS expiry_log_brain_idx
  ON public.expiry_notification_log (brain_id, sent_at DESC);
