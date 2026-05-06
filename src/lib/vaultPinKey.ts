// PIN-wrapped vault key — crypto + persistence.
//
// Sub-project 3 of 5 in EML "Vault — beyond V3 narrow scope":
// PIN + biometric + dormant auto-lock.
//
// After the user unlocks once with their passphrase, they can opt into a
// shorter PIN (4-6 digits) for subsequent opens. The PIN derives a wrapper
// AES key via PBKDF2 (310k iterations, same as the master passphrase), and
// the raw vault key is encrypted with the wrapper. The wrapped blob lives
// in localStorage on this device only — never synced to the server.
//
// Forgot PIN → fall back to master passphrase. Forgot both → recovery key
// (existing flow). PIN is per-device by design — typing the same PIN on a
// second device does NOT unlock the vault there; the user re-bootstraps
// with their passphrase, generating a new wrapped blob with a new salt.
//
// Biometric path (src/lib/biometric.ts) reuses this same wrap-master-with-
// derived-AES pattern — but the derived key comes from WebAuthn prf output
// instead of PBKDF2-on-PIN.

const CIPHER = "AES-GCM";
const IV_BYTES = 12;
const PIN_PBKDF2_ITERATIONS = 310_000;

const PIN_KEY = "em_vault_pin_v1";
const BIO_KEY = "em_vault_bio_v1";

export interface PinRecord {
  wrapped_b64: string;
  salt_hex: string;
  iv_hex: string;
  configured_at: string;
}

export interface BiometricRecord {
  wrapped_b64: string;
  iv_hex: string;
  credential_id_b64: string;
  configured_at: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function hexToBytes(hex: string): Uint8Array {
  const m = hex.match(/.{2}/g);
  if (!m) return new Uint8Array(0);
  return new Uint8Array(m.map((b) => parseInt(b, 16)));
}
function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveAesKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin) as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PIN_PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: CIPHER, length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function aesKeyFromRaw(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: CIPHER, length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// ── PIN wrap / unwrap ──

export async function wrapVaultKeyWithPin(vaultKey: CryptoKey, pin: string): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrapKey = await deriveAesKeyFromPin(pin, salt);
  const rawVault = new Uint8Array(await crypto.subtle.exportKey("raw", vaultKey));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: CIPHER, iv: iv as BufferSource },
      wrapKey,
      rawVault as BufferSource,
    ),
  );
  return {
    wrapped_b64: bytesToB64(cipher),
    salt_hex: bytesToHex(salt),
    iv_hex: bytesToHex(iv),
    configured_at: new Date().toISOString(),
  };
}

export async function unwrapVaultKeyWithPin(
  record: PinRecord,
  pin: string,
): Promise<CryptoKey | null> {
  try {
    const salt = hexToBytes(record.salt_hex);
    const iv = hexToBytes(record.iv_hex);
    const cipher = b64ToBytes(record.wrapped_b64);
    const wrapKey = await deriveAesKeyFromPin(pin, salt);
    const raw = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: CIPHER, iv: iv as BufferSource },
        wrapKey,
        cipher as BufferSource,
      ),
    );
    return await aesKeyFromRaw(raw);
  } catch {
    return null;
  }
}

// ── Biometric wrap / unwrap (uses prf-derived key material as the wrapper) ──

export async function wrapVaultKeyWithBiometricMaterial(
  vaultKey: CryptoKey,
  prfOutput: Uint8Array,
  credentialIdB64: string,
): Promise<BiometricRecord> {
  if (prfOutput.byteLength < 32) {
    throw new Error("prf output is too short for AES-256");
  }
  const wrapKey = await aesKeyFromRaw(prfOutput.slice(0, 32));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const rawVault = new Uint8Array(await crypto.subtle.exportKey("raw", vaultKey));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: CIPHER, iv: iv as BufferSource },
      wrapKey,
      rawVault as BufferSource,
    ),
  );
  return {
    wrapped_b64: bytesToB64(cipher),
    iv_hex: bytesToHex(iv),
    credential_id_b64: credentialIdB64,
    configured_at: new Date().toISOString(),
  };
}

export async function unwrapVaultKeyWithBiometricMaterial(
  record: BiometricRecord,
  prfOutput: Uint8Array,
): Promise<CryptoKey | null> {
  try {
    if (prfOutput.byteLength < 32) return null;
    const wrapKey = await aesKeyFromRaw(prfOutput.slice(0, 32));
    const iv = hexToBytes(record.iv_hex);
    const cipher = b64ToBytes(record.wrapped_b64);
    const raw = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: CIPHER, iv: iv as BufferSource },
        wrapKey,
        cipher as BufferSource,
      ),
    );
    return await aesKeyFromRaw(raw);
  } catch {
    return null;
  }
}

// ── Persistence (localStorage, per-device, never synced) ──

export function loadPinRecord(): PinRecord | null {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PinRecord;
    if (!parsed?.wrapped_b64 || !parsed.salt_hex || !parsed.iv_hex) return null;
    return parsed;
  } catch {
    return null;
  }
}
export function savePinRecord(record: PinRecord): void {
  localStorage.setItem(PIN_KEY, JSON.stringify(record));
}
export function clearPinRecord(): void {
  localStorage.removeItem(PIN_KEY);
}

export function loadBiometricRecord(): BiometricRecord | null {
  try {
    const raw = localStorage.getItem(BIO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BiometricRecord;
    if (!parsed?.wrapped_b64 || !parsed.iv_hex || !parsed.credential_id_b64) return null;
    return parsed;
  } catch {
    return null;
  }
}
export function saveBiometricRecord(record: BiometricRecord): void {
  localStorage.setItem(BIO_KEY, JSON.stringify(record));
}
export function clearBiometricRecord(): void {
  localStorage.removeItem(BIO_KEY);
}

// ── Validation ──

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

// Test-only: silence unused-import warning if a consumer uses dec directly.
void dec;
