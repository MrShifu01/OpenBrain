// Bundles the user's vault setup (salt + verify token + recovery blob) and
// every encrypted vault_entry into a single JSON file the offline decrypt
// tool at /decrypt.html can consume. Honours the /privacy promise:
// "a separate offline decryption tool is on the roadmap".
//
// Spec: docs/superpowers/specs/2026-05-02-vault-entry-templates-design.md
//   (sub-project 2 — offline decryption tool)
//
// The exported JSON shape is documented inline; bump `version` if it ever
// changes incompatibly so old decrypt tools fail loudly instead of silently.

import { authFetch } from "./authFetch";

export interface VaultBackupV1 {
  version: "everion-vault-export-v1";
  exported_at: string;
  vault: {
    salt: string;
    verify_token: string;
    recovery_blob: string;
  };
  entries: Array<{
    id: string;
    title: string;
    content: string; // ciphertext
    metadata: string; // ciphertext
    tags: string[];
    brain_id?: string | null;
    created_at?: string;
    updated_at?: string;
  }>;
}

export async function buildVaultBackup(): Promise<VaultBackupV1> {
  const [vaultRes, entriesRes] = await Promise.all([
    authFetch("/api/vault"),
    authFetch("/api/vault-entries"),
  ]);
  if (!vaultRes.ok) throw new Error(`Vault setup fetch failed (${vaultRes.status})`);
  if (!entriesRes.ok) throw new Error(`Vault entries fetch failed (${entriesRes.status})`);
  const vault = (await vaultRes.json()) as {
    salt?: string;
    verify_token?: string;
    recovery_blob?: string;
  } | null;
  if (!vault?.salt || !vault.verify_token) {
    throw new Error("No vault setup on this account — nothing to back up.");
  }
  const entries = (await entriesRes.json()) as VaultBackupV1["entries"];
  return {
    version: "everion-vault-export-v1",
    exported_at: new Date().toISOString(),
    vault: {
      salt: vault.salt,
      verify_token: vault.verify_token,
      recovery_blob: vault.recovery_blob ?? "",
    },
    entries: entries.map((e) => ({
      id: e.id,
      title: e.title,
      content: e.content,
      metadata: e.metadata,
      tags: e.tags ?? [],
      brain_id: e.brain_id ?? null,
      created_at: e.created_at,
      updated_at: e.updated_at,
    })),
  };
}

export function downloadVaultBackup(backup: VaultBackupV1): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = backup.exported_at.slice(0, 10);
  a.download = `everion-vault-backup-${stamp}.json`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}
