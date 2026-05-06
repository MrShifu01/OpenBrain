// Owner-side helpers for granting / revoking vault access on a shared
// brain. Keeps the BrainTab UI thin and the crypto choreography in one
// place — pull the cached master KEK, unwrap the private key, ensure
// the brain has a DEK, fetch the target user's public key, wrap, POST.

import { authFetch } from "./authFetch";
import { supabase, readCachedSession } from "./supabase";
import {
  getCachedVaultKey,
  unwrapPrivateKey,
  importPublicKey,
  generateBrainDEK,
  wrapDEK,
  unwrapDEK,
} from "./crypto";

interface VaultRow {
  exists?: boolean;
  public_key?: string | null;
  wrapped_private_key?: string | null;
}

interface GrantRow {
  brain_id: string;
  user_id: string;
  wrapped_dek: string;
}

async function loadOwnVaultRow(): Promise<VaultRow | null> {
  const r = await authFetch("/api/vault");
  if (!r.ok) return null;
  return (await r.json()) as VaultRow;
}

async function loadOwnPrivateKey(masterKEK: CryptoKey): Promise<CryptoKey | null> {
  const row = await loadOwnVaultRow();
  if (!row?.wrapped_private_key) return null;
  return unwrapPrivateKey(row.wrapped_private_key, masterKEK);
}

async function loadOwnGrantForBrain(
  brainId: string,
  privateKey: CryptoKey,
): Promise<CryptoKey | null> {
  const r = await authFetch("/api/brain-vault-grants");
  if (!r.ok) return null;
  const grants: GrantRow[] = await r.json();
  const mine = grants.find((g) => g.brain_id === brainId);
  if (!mine) return null;
  return unwrapDEK(mine.wrapped_dek, privateKey);
}

async function fetchOwnUserId(): Promise<string | null> {
  // Read from the Supabase auth session — this is always the authoritative
  // source for "who am I". The previous implementation hit /api/profile and
  // expected `{ id }` at the top level, but that endpoint returns
  // `{ profile: { user_id } | null }` and `profile` is null for users who
  // haven't filled in About-You — so granting vault access from a fresh
  // account would always fail with "Couldn't resolve your user id".
  const cached = readCachedSession();
  if (cached?.user?.id) return cached.user.id;
  // Fallback for the rare boot window where the cache hasn't materialised
  // yet (private-mode or cache-cleared session).
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

async function fetchTargetPublicKey(userId: string): Promise<CryptoKey | null> {
  const r = await authFetch(`/api/vault?action=public-key&user_id=${encodeURIComponent(userId)}`);
  if (!r.ok) return null;
  const data = (await r.json()) as { public_key?: string | null };
  if (!data?.public_key) return null;
  return importPublicKey(data.public_key);
}

export class VaultGrantError extends Error {
  constructor(
    message: string,
    public code:
      | "vault-locked"
      | "no-keypair"
      | "target-no-keypair"
      | "no-user-id"
      | "post-failed"
      | "unknown",
  ) {
    super(message);
    this.name = "VaultGrantError";
  }
}

// Grant a member access to this brain's vault. If the brain doesn't
// have a DEK yet, mints one and self-grants it before wrapping for the
// target. Idempotent on the server (Prefer: merge-duplicates) so calling
// twice on the same (brain, user) just refreshes the wrapped_dek row.
export async function grantBrainVaultAccess(brainId: string, targetUserId: string): Promise<void> {
  const masterKEK = await getCachedVaultKey();
  if (!masterKEK) {
    throw new VaultGrantError("Unlock your vault first to share it.", "vault-locked");
  }

  const privateKey = await loadOwnPrivateKey(masterKEK);
  if (!privateKey) {
    throw new VaultGrantError(
      "Your vault keypair isn't set up yet — open the Vault tab once to backfill it, then retry.",
      "no-keypair",
    );
  }

  // Get or mint the brain's DEK. If we have an existing self-grant we
  // reuse the same DEK so the brain's vault keeps a stable key across
  // member additions.
  let dek = await loadOwnGrantForBrain(brainId, privateKey);
  if (!dek) {
    const myUserId = await fetchOwnUserId();
    if (!myUserId) {
      throw new VaultGrantError("Couldn't resolve your user id.", "no-user-id");
    }
    const ownVaultRow = await loadOwnVaultRow();
    const ownPubSpki = ownVaultRow?.public_key;
    if (!ownPubSpki) {
      throw new VaultGrantError(
        "Your vault keypair isn't set up yet — open the Vault tab once to backfill it, then retry.",
        "no-keypair",
      );
    }
    const ownPub = await importPublicKey(ownPubSpki);
    dek = await generateBrainDEK();
    const wrappedForSelf = await wrapDEK(dek, ownPub);
    const selfGrant = await authFetch("/api/brain-vault-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brain_id: brainId,
        user_id: myUserId,
        wrapped_dek: wrappedForSelf,
      }),
    });
    if (!selfGrant.ok) {
      throw new VaultGrantError(
        `Couldn't seed the brain's vault key (HTTP ${selfGrant.status}).`,
        "post-failed",
      );
    }
  }

  const targetPub = await fetchTargetPublicKey(targetUserId);
  if (!targetPub) {
    throw new VaultGrantError(
      "That member hasn't set up their vault yet — they need to open the Vault tab once before you can share with them.",
      "target-no-keypair",
    );
  }

  const wrappedForTarget = await wrapDEK(dek, targetPub);
  const r = await authFetch("/api/brain-vault-grants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brain_id: brainId,
      user_id: targetUserId,
      wrapped_dek: wrappedForTarget,
    }),
  });
  if (!r.ok) {
    throw new VaultGrantError(`Grant POST failed (HTTP ${r.status}).`, "post-failed");
  }
}

export async function revokeBrainVaultAccess(brainId: string, targetUserId: string): Promise<void> {
  const r = await authFetch(
    `/api/brain-vault-grants?brain_id=${encodeURIComponent(brainId)}&user_id=${encodeURIComponent(targetUserId)}`,
    { method: "DELETE" },
  );
  if (!r.ok) {
    throw new VaultGrantError(`Revoke failed (HTTP ${r.status}).`, "post-failed");
  }
}

// Owner view: list every grant on a given brain so the UI can show
// "has vault access" / "doesn't have vault access" per member.
export async function listBrainGrants(brainId: string): Promise<GrantRow[]> {
  const r = await authFetch(`/api/brain-vault-grants?brain_id=${encodeURIComponent(brainId)}`);
  if (!r.ok) return [];
  return (await r.json()) as GrantRow[];
}
