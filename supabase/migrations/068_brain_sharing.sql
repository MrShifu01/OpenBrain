-- 068: brain_members + brain_invites — phase 2 of multi-brain (sharing)
--
-- Phase 1 (migration 060) gave users multiple personal brains. This migration
-- adds the ability to invite other users to a brain by email and grant them
-- one of two roles:
--   • member  — read + write entries, chat, search
--   • viewer  — read-only (no insert / update / delete on entries)
-- Owner remains a derived role from brains.owner_id; not stored in brain_members.
-- The owner can additionally invite, remove members, change roles, rename and
-- delete the brain.
--
-- Frontend wiring (App.tsx) already reads ?invite=<token> from URL, stashes
-- it across the auth round-trip, and POSTs /api/brains?action=accept with
-- { token } once signed in — backend lands in this commit alongside the
-- migration.

-- ── brain_members ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brain_members (
  brain_id     uuid NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('viewer', 'member')),
  invited_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brain_id, user_id)
);

-- Reverse lookup: "what brains can this user access" — used by /api/brains
-- to merge owned + shared into a single list.
CREATE INDEX IF NOT EXISTS brain_members_user_idx
  ON public.brain_members (user_id, brain_id);

ALTER TABLE public.brain_members ENABLE ROW LEVEL SECURITY;

-- RLS: a user can SELECT their own membership row, AND a brain owner can
-- SELECT every membership row for their brain. Mutations are service-role
-- only (server enforces invite/accept/remove flows).
DROP POLICY IF EXISTS brain_members_select ON public.brain_members;
CREATE POLICY brain_members_select
  ON public.brain_members FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR brain_id IN (SELECT id FROM public.brains WHERE owner_id = (SELECT auth.uid()))
  );

-- ── brain_invites ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brain_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id     uuid NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         text NOT NULL CHECK (role IN ('viewer', 'member')),
  token        text NOT NULL UNIQUE,
  invited_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS brain_invites_brain_idx
  ON public.brain_invites (brain_id, created_at DESC);

CREATE INDEX IF NOT EXISTS brain_invites_email_pending_idx
  ON public.brain_invites (lower(email))
  WHERE accepted_at IS NULL;

ALTER TABLE public.brain_invites ENABLE ROW LEVEL SECURITY;

-- RLS: brain owner only. Token redemption goes through the API (service role)
-- so no anon SELECT policy is needed.
DROP POLICY IF EXISTS brain_invites_select ON public.brain_invites;
CREATE POLICY brain_invites_select
  ON public.brain_invites FOR SELECT TO authenticated
  USING (brain_id IN (SELECT id FROM public.brains WHERE owner_id = (SELECT auth.uid())));

-- ── Update brains_select to include shared access ────────────────────────
DROP POLICY IF EXISTS brains_select ON public.brains;
CREATE POLICY brains_select
  ON public.brains FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR id IN (SELECT brain_id FROM public.brain_members WHERE user_id = (SELECT auth.uid()))
  );

-- ── Update entries policies for membership ──────────────────────────────
-- Today entries.user_id holds the row creator. Readers must include other
-- members of the brain. Writers (insert/update/delete) are still scoped to
-- the creator OR the brain owner; viewers must not write.
DROP POLICY IF EXISTS entries_all ON public.entries;

CREATE POLICY entries_select
  ON public.entries FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR brain_id IN (
      SELECT brain_id FROM public.brain_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- Insert: the row's user_id must match the caller AND the caller must be
-- the brain owner OR a member (not viewer). Viewers cannot create entries.
CREATE POLICY entries_insert
  ON public.entries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      brain_id IN (SELECT id FROM public.brains WHERE owner_id = (SELECT auth.uid()))
      OR brain_id IN (
        SELECT brain_id FROM public.brain_members
        WHERE user_id = (SELECT auth.uid()) AND role = 'member'
      )
    )
  );

-- Update: only the creator. Owners can also update via service role API.
CREATE POLICY entries_update
  ON public.entries FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Delete: creator OR brain owner.
CREATE POLICY entries_delete
  ON public.entries FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR brain_id IN (SELECT id FROM public.brains WHERE owner_id = (SELECT auth.uid()))
  );

COMMENT ON TABLE public.brain_members IS
  'Phase-2 multi-brain sharing: which users have access to which non-personal brains, with what role. Owner is derived from brains.owner_id and is NOT stored here.';
COMMENT ON TABLE public.brain_invites IS
  'Pending email-keyed invites to join a brain. Redeemed via /api/brains?action=accept once the recipient signs in with a matching email. Single-use; expires in 7 days by default.';
