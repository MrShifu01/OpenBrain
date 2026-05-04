-- 072: per-brain envelope encryption (phase 2 of per-brain vaults).
--
-- Each user has ONE master passphrase, derived into a KEK as today.
-- Phase 2 adds two pieces on top so multiple users can share a brain's
-- vault without sharing passphrases:
--
--  1. Each user gets an asymmetric keypair. Private key is wrapped with
--     their master KEK and stored encrypted; public key is stored in
--     the clear so other users can wrap data-encryption-keys for them.
--
--  2. Each shared brain gets a random data-encryption-key (DEK). The
--     DEK is never stored unwrapped — every member who has access has
--     a row in brain_vault_grants holding the DEK encrypted with their
--     public key. Member's passphrase → KEK → unwrap private key →
--     unwrap DEK → decrypt secrets.
--
-- The personal brain still encrypts secrets directly with the master
-- KEK (no DEK overhead) — only the user themselves ever needs them.
-- Existing secrets in any brain stay as-is (legacy master-key encrypted)
-- and are read with a fallback path. New secrets in non-personal brains
-- use the DEK envelope.

ALTER TABLE public.vault_keys
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS wrapped_private_key text;

CREATE TABLE IF NOT EXISTS public.brain_vault_grants (
  brain_id    uuid NOT NULL REFERENCES public.brains(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  wrapped_dek text NOT NULL,
  granted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brain_id, user_id)
);

CREATE INDEX IF NOT EXISTS brain_vault_grants_user_idx
  ON public.brain_vault_grants (user_id);
CREATE INDEX IF NOT EXISTS brain_vault_grants_brain_idx
  ON public.brain_vault_grants (brain_id);

ALTER TABLE public.brain_vault_grants ENABLE ROW LEVEL SECURITY;

-- A grant row is readable to:
--  • the recipient (so they can fetch their wrapped DEK on unlock), or
--  • the brain owner (who needs to manage which members have access).
CREATE POLICY brain_vault_grants_select
  ON public.brain_vault_grants FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_brain_owner(brain_id, (SELECT auth.uid()))
  );

-- Inserts: brain owner is the only one who can mint a grant. The owner
-- is also allowed to create their OWN grant on a brain they own (the
-- first DEK on a brain is the owner wrapping it for themselves).
CREATE POLICY brain_vault_grants_insert
  ON public.brain_vault_grants FOR INSERT TO authenticated
  WITH CHECK (
    public.is_brain_owner(brain_id, (SELECT auth.uid()))
  );

-- Owner-only revoke. (When a member is removed from a brain, the owner
-- deletes the grant row and rotates the DEK — both done client-side.)
CREATE POLICY brain_vault_grants_delete
  ON public.brain_vault_grants FOR DELETE TO authenticated
  USING (
    public.is_brain_owner(brain_id, (SELECT auth.uid()))
  );

-- Narrow lookup so a user can fetch another user's public key (needed
-- to wrap a DEK for them) without exposing salt/verify_token/etc.
-- SECURITY DEFINER so it bypasses vault_keys RLS, returning the public
-- column only.
CREATE OR REPLACE FUNCTION public.get_user_public_key(target_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public_key FROM public.vault_keys WHERE user_id = target_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_user_public_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_public_key(uuid) TO authenticated;
