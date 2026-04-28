-- Multi-brain phase 1: revive multiple brains per user.
-- Reverses migration 025's single-brain collapse without bringing back sharing
-- infrastructure (brain_members / brain_invites). Sharing lands in phase 2.
--
-- Safe to run on any state: existing rows backfill to is_personal=true.

-- 1. Drop the one-brain-per-user constraint from migration 025
ALTER TABLE brains DROP CONSTRAINT IF EXISTS brains_one_per_user;

-- 2. Mark personal brain + add description for blank-slate naming
ALTER TABLE brains
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Backfill: every existing brain becomes the user's personal brain.
-- (Pre-059 schema only allowed one brain per user, so this is unambiguous.)
UPDATE brains SET is_personal = true WHERE is_personal = false;

-- Enforce: at most one personal brain per user. Additional shared brains
-- have is_personal=false and are unconstrained in count.
CREATE UNIQUE INDEX IF NOT EXISTS brains_one_personal_per_user
  ON brains(owner_id) WHERE is_personal = true;

-- 3. Update signup trigger to set is_personal on auto-created brain
CREATE OR REPLACE FUNCTION create_personal_brain_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO brains (name, owner_id, is_personal)
  VALUES ('My Brain', NEW.id, true);
  RETURN NEW;
END;
$$;

-- 4. Persist active brain across devices
ALTER TABLE user_ai_settings
  ADD COLUMN IF NOT EXISTS active_brain_id UUID
    REFERENCES brains(id) ON DELETE SET NULL;

-- 5. RLS — owner can do anything with their own brains. No change for entries:
-- entries.brain_id → brains.owner_id chain is already gated by existing policies.
DROP POLICY IF EXISTS brains_owner_all ON brains;
CREATE POLICY brains_owner_all ON brains FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
