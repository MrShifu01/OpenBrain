-- Migration 058: Add onboarded_at to user_profiles
-- Sync onboarding-completion across devices instead of relying on
-- localStorage alone. A user who clears cookies or signs in on a new
-- browser should not be re-onboarded.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.onboarded_at IS
  'Timestamp the user completed (or skipped) onboarding. NULL = not yet onboarded.';
