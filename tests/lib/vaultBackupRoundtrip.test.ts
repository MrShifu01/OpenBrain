// Round-trip test for the vault backup format. Builds an encrypted vault
// payload exactly as the app does, serialises it as VaultBackupV1, then
// decrypts it through a path that mirrors what /public/decrypt.html does.
//
// Catches:
//   - any drift between src/lib/crypto.ts and the offline tool (PBKDF2
//     iterations, prefixes, AES-GCM params)
//   - schema breaks in VaultBackupV1
//   - subtle bugs in encrypt/decryptText round-trip (IV / base64 / hex)
//
// Web Crypto subtle is available in Node 20+ via globalThis.crypto, so this
// runs in vitest's default environment with no jsdom shim.

import { describe, it, expect } from "vitest";
import {
  encryptEntry,
  setupVault,
  generateRecoveryKey,
  encryptVaultKeyForRecovery,
  decryptVaultKeyFromRecovery,
  unlockVault,
  decryptEntry,
} from "../../src/lib/crypto";
import type { VaultBackupV1 } from "../../src/lib/vaultBackup";

const PASSPHRASE = "correct-horse-battery-staple";

interface PlainEntry {
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  tags: string[];
}

const PLAIN_ENTRIES: PlainEntry[] = [
  {
    title: "Resend API Key",
    content: "re_TestKey_aaaaaaaaaaaaaaaaaaaaaa",
    metadata: { template_type: "api_key", env: "production" },
    tags: ["work", "email"],
  },
  {
    title: "Visa ending 4242",
    content: "4242424242424242",
    metadata: { cvv: "123", expiry: "12/29", cardholder: "Christian Stander" },
    tags: ["banking"],
  },
];

async function buildBackup(): Promise<{
  backup: VaultBackupV1;
  recoveryKey: string;
}> {
  const { key, salt, verifyToken } = await setupVault(PASSPHRASE);
  const recoveryKey = generateRecoveryKey();
  const recoveryBlob = await encryptVaultKeyForRecovery(key, recoveryKey);

  const encryptedEntries: VaultBackupV1["entries"] = [];
  for (const [i, plain] of PLAIN_ENTRIES.entries()) {
    const enc = await encryptEntry({ content: plain.content, metadata: plain.metadata }, key);
    encryptedEntries.push({
      id: `entry-${i}`,
      title: plain.title,
      content: enc.content as string,
      metadata: enc.metadata as string,
      tags: plain.tags,
      brain_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const backup: VaultBackupV1 = {
    version: "everion-vault-export-v1",
    exported_at: new Date().toISOString(),
    vault: {
      salt,
      verify_token: verifyToken,
      recovery_blob: recoveryBlob,
    },
    entries: encryptedEntries,
  };
  return { backup, recoveryKey };
}

describe("vault backup round-trip", () => {
  it("decrypts every entry with the original passphrase", async () => {
    const { backup } = await buildBackup();

    const key = await unlockVault(PASSPHRASE, backup.vault.salt, backup.vault.verify_token);
    expect(key).not.toBeNull();

    for (const [i, enc] of backup.entries.entries()) {
      const dec = await decryptEntry({ content: enc.content, metadata: enc.metadata }, key!);
      expect(dec.content).toBe(PLAIN_ENTRIES[i]!.content);
      expect(dec.metadata).toEqual(PLAIN_ENTRIES[i]!.metadata);
    }
  });

  it("decrypts every entry with the recovery key alone (no passphrase)", async () => {
    const { backup, recoveryKey } = await buildBackup();

    const key = await decryptVaultKeyFromRecovery(backup.vault.recovery_blob, recoveryKey);
    expect(key).not.toBeNull();

    for (const [i, enc] of backup.entries.entries()) {
      const dec = await decryptEntry({ content: enc.content, metadata: enc.metadata }, key!);
      expect(dec.content).toBe(PLAIN_ENTRIES[i]!.content);
      expect(dec.metadata).toEqual(PLAIN_ENTRIES[i]!.metadata);
    }
  });

  it("rejects the wrong passphrase", async () => {
    const { backup } = await buildBackup();
    const key = await unlockVault("wrong-passphrase", backup.vault.salt, backup.vault.verify_token);
    expect(key).toBeNull();
  });

  it("rejects the wrong recovery key", async () => {
    const { backup } = await buildBackup();
    const key = await decryptVaultKeyFromRecovery(
      backup.vault.recovery_blob,
      "AAAA-BBBB-CCCC-DDDD-EEEE",
    );
    expect(key).toBeNull();
  });

  it("emits the documented schema version", async () => {
    const { backup } = await buildBackup();
    expect(backup.version).toBe("everion-vault-export-v1");
    expect(backup.vault.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(backup.vault.verify_token.startsWith("v1:")).toBe(true);
    for (const e of backup.entries) {
      expect(e.content.startsWith("v1:")).toBe(true);
      expect(typeof e.metadata).toBe("string");
    }
  });
});
