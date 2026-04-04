/**
 * OpenBrain Client-Side Encryption — AES-256-GCM
 *
 * Architecture:
 *   - Each user gets a device-bound AES-256-GCM CryptoKey stored in IndexedDB.
 *   - The key is non-exportable and never leaves the device.
 *   - Encrypted fields are stored as "v1:<ivHex>:<ciphertextBase64>".
 *   - Passphrase-based key derivation (PBKDF2) is available as an opt-in
 *     alternative for users who want cross-device key portability.
 *
 * Activation:
 *   - Call getOrCreateKey(userId) once on login to prime the key.
 *   - Call encryptText(plaintext, key) before storing sensitive fields.
 *   - Call decryptText(ciphertext, key) after fetching entries.
 *   - Use isEncrypted(str) to detect whether a field is encrypted.
 *
 * Trade-offs (acknowledged in GAPS.md):
 *   - Encrypted entries cannot be embedded or semantically searched server-side.
 *   - RAG/pgvector features are disabled for encrypted entries.
 *   - Mitigate with client-side MiniSearch on decrypted content (future phase).
 *   - Full E2EE (Phase 2): per-brain X25519 keys + brain_keys table.
 */

const DB_NAME = "openbrain-crypto";
const DB_VERSION = 1;
const STORE = "keys";
const CIPHER = "AES-GCM";
const IV_BYTES = 12; // 96-bit IV for AES-GCM
const CIPHERTEXT_PREFIX = "v1:";

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function _openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function _storeKey(userId, cryptoKey) {
  const db = await _openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: userId, key: cryptoKey });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function _loadKey(userId) {
  const db = await _openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(userId);
    req.onsuccess = () => resolve(req.result?.key ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ─── Key management ───────────────────────────────────────────────────────────

/**
 * Returns the user's device-bound AES-256-GCM CryptoKey.
 * Generates and persists a new key if none exists for this userId.
 *
 * The key is non-extractable — it cannot leave IndexedDB.
 *
 * @param {string} userId
 * @returns {Promise<CryptoKey>}
 */
export async function getOrCreateKey(userId) {
  if (!userId) throw new Error("userId required");

  const existing = await _loadKey(userId);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: CIPHER, length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"]
  );
  await _storeKey(userId, key);
  return key;
}

/**
 * Derives a CryptoKey from a passphrase using PBKDF2-SHA256.
 * Use this when the user wants cross-device key portability via a passphrase.
 * The returned key IS extractable (needed for backup/restore).
 *
 * @param {string} passphrase
 * @param {Uint8Array} salt - 16 random bytes; store alongside encrypted data for recovery
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKeyFromPassphrase(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    keyMaterial,
    { name: CIPHER, length: 256 },
    true, // extractable — needed for passphrase-based backup
    ["encrypt", "decrypt"]
  );
}

/**
 * Generates a fresh 16-byte random salt for PBKDF2 key derivation.
 * @returns {Uint8Array}
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * Encrypts a string with AES-256-GCM.
 *
 * @param {string} plaintext
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<string>} "v1:<ivHex>:<ciphertextBase64>"
 */
export async function encryptText(plaintext, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: CIPHER, iv }, cryptoKey, encoded);

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuf)));
  return `${CIPHERTEXT_PREFIX}${ivHex}:${cipherB64}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext produced by encryptText.
 *
 * @param {string} encoded - "v1:<ivHex>:<ciphertextBase64>"
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<string>} plaintext
 * @throws if the ciphertext is malformed or the key is wrong
 */
export async function decryptText(encoded, cryptoKey) {
  if (!encoded.startsWith(CIPHERTEXT_PREFIX)) {
    throw new Error("Not an encrypted value");
  }
  const inner = encoded.slice(CIPHERTEXT_PREFIX.length);
  const colonIdx = inner.indexOf(":");
  if (colonIdx === -1) throw new Error("Malformed ciphertext");

  const ivHex = inner.slice(0, colonIdx);
  const cipherB64 = inner.slice(colonIdx + 1);

  const iv = new Uint8Array(ivHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const cipherBuf = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));

  const plainBuf = await crypto.subtle.decrypt({ name: CIPHER, iv }, cryptoKey, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}

/**
 * Returns true if the string looks like an encrypted value from this library.
 * @param {string} str
 * @returns {boolean}
 */
export function isEncrypted(str) {
  return typeof str === "string" && str.startsWith(CIPHERTEXT_PREFIX);
}

// ─── Vault helpers ───────────────────────────────────────────────────────────

const VAULT_VERIFY_PLAINTEXT = "openbrain-vault-ok";

/**
 * Sets up a new vault: generates salt, derives key from passphrase,
 * produces a verify_token to confirm correct passphrase on future unlocks.
 *
 * @param {string} passphrase
 * @returns {Promise<{ key: CryptoKey, salt: string, verifyToken: string }>}
 */
export async function setupVault(passphrase) {
  const saltBytes = generateSalt();
  const key = await deriveKeyFromPassphrase(passphrase, saltBytes);
  const verifyToken = await encryptText(VAULT_VERIFY_PLAINTEXT, key);
  const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return { key, salt: saltHex, verifyToken };
}

/**
 * Unlocks an existing vault by deriving the key from passphrase + stored salt,
 * then verifying the key against the stored verify_token.
 *
 * @param {string} passphrase
 * @param {string} saltHex - 32-char hex string from server
 * @param {string} verifyToken - encrypted verification string from server
 * @returns {Promise<CryptoKey|null>} The derived key, or null if passphrase is wrong
 */
export async function unlockVault(passphrase, saltHex, verifyToken) {
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await deriveKeyFromPassphrase(passphrase, saltBytes);
  try {
    const plain = await decryptText(verifyToken, key);
    if (plain === VAULT_VERIFY_PLAINTEXT) return key;
    return null;
  } catch {
    return null; // wrong passphrase — decryption fails
  }
}

// ─── Recovery key ────────────────────────────────────────────────────────────

const RECOVERY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

/**
 * Generates a human-readable recovery key like "BRAIN-KXMF-92PL-TQVW-7DJH".
 * 5 groups × 4 chars = 20 chars from a 30-char alphabet ≈ 98 bits of entropy.
 * @returns {string}
 */
export function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const groups = [];
  for (let g = 0; g < 5; g++) {
    let chunk = "";
    for (let i = 0; i < 4; i++) {
      chunk += RECOVERY_CHARS[bytes[g * 4 + i] % RECOVERY_CHARS.length];
    }
    groups.push(chunk);
  }
  return groups.join("-");
}

/**
 * Encrypts the vault CryptoKey with a recovery-key-derived AES key,
 * producing a blob that can be stored on the server.
 *
 * @param {CryptoKey} vaultKey - the extractable vault key
 * @param {string} recoveryKey - e.g. "KXMF-92PL-TQVW-7DJH-ABCD"
 * @returns {Promise<string>} encrypted blob (salt + ciphertext)
 */
export async function encryptVaultKeyForRecovery(vaultKey, recoveryKey) {
  // Export the raw vault key bytes
  const rawKey = await crypto.subtle.exportKey("raw", vaultKey);
  const rawKeyB64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));

  // Derive an AES key from the recovery key
  const recoverySalt = generateSalt();
  const recoveryAesKey = await deriveKeyFromPassphrase(recoveryKey, recoverySalt);

  // Encrypt the raw vault key with the recovery-derived key
  const ciphertext = await encryptText(rawKeyB64, recoveryAesKey);

  // Combine salt + ciphertext so we can re-derive on recovery
  const saltHex = Array.from(recoverySalt).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${ciphertext}`;
}

/**
 * Decrypts a vault key from a recovery blob using the recovery key.
 *
 * @param {string} recoveryBlob - "saltHex:v1:iv:ciphertext" from server
 * @param {string} recoveryKey - the user's recovery key string
 * @returns {Promise<CryptoKey|null>} the vault CryptoKey, or null if wrong key
 */
export async function decryptVaultKeyFromRecovery(recoveryBlob, recoveryKey) {
  try {
    const firstColon = recoveryBlob.indexOf(":");
    const saltHex = recoveryBlob.slice(0, firstColon);
    const ciphertext = recoveryBlob.slice(firstColon + 1);

    const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const recoveryAesKey = await deriveKeyFromPassphrase(recoveryKey, saltBytes);

    const rawKeyB64 = await decryptText(ciphertext, recoveryAesKey);
    const rawKeyBytes = Uint8Array.from(atob(rawKeyB64), c => c.charCodeAt(0));

    // Re-import as an AES-GCM CryptoKey
    return await crypto.subtle.importKey(
      "raw",
      rawKeyBytes,
      { name: CIPHER, length: 256 },
      true, // extractable (same as original)
      ["encrypt", "decrypt"]
    );
  } catch {
    return null; // wrong recovery key
  }
}

// ─── Bulk helpers ─────────────────────────────────────────────────────────────

/**
 * Encrypts the sensitive fields of an entry object in-place.
 * Skips fields that are already encrypted.
 *
 * Fields encrypted: content, metadata (JSON-serialised)
 *
 * @param {{ content?: string, metadata?: object }} entry
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<object>} new entry object with encrypted fields
 */
export async function encryptEntry(entry, cryptoKey) {
  const out = { ...entry };
  if (entry.content && !isEncrypted(entry.content)) {
    out.content = await encryptText(entry.content, cryptoKey);
  }
  if (entry.metadata && typeof entry.metadata === "object") {
    const metaStr = JSON.stringify(entry.metadata);
    out.metadata = await encryptText(metaStr, cryptoKey);
  }
  return out;
}

/**
 * Decrypts the sensitive fields of an entry object in-place.
 * Skips fields that are not encrypted.
 *
 * @param {{ content?: string, metadata?: string|object }} entry
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<object>} new entry object with decrypted fields
 */
export async function decryptEntry(entry, cryptoKey) {
  const out = { ...entry };
  if (isEncrypted(entry.content)) {
    try {
      out.content = await decryptText(entry.content, cryptoKey);
    } catch {
      out.content = "[encrypted — key mismatch or corrupted]";
    }
  }
  if (isEncrypted(entry.metadata)) {
    try {
      out.metadata = JSON.parse(await decryptText(entry.metadata, cryptoKey));
    } catch {
      out.metadata = {};
    }
  }
  return out;
}
