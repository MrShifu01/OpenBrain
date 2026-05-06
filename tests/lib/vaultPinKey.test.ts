import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  wrapVaultKeyWithPin,
  unwrapVaultKeyWithPin,
  wrapVaultKeyWithBiometricMaterial,
  unwrapVaultKeyWithBiometricMaterial,
  isValidPin,
  loadPinRecord,
  savePinRecord,
  clearPinRecord,
  loadBiometricRecord,
  saveBiometricRecord,
  clearBiometricRecord,
} from "../../src/lib/vaultPinKey";
import { setupVault, encryptText, decryptText } from "../../src/lib/crypto";

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});

describe("isValidPin", () => {
  it("accepts 4-8 digit numeric strings", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345678")).toBe(true);
  });
  it("rejects too short / too long / non-digits", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("123456789")).toBe(false);
    expect(isValidPin("abcd")).toBe(false);
    expect(isValidPin("12 34")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });
});

describe("PIN wrap / unwrap", () => {
  it("round-trips: encrypt with vault key → wrap with PIN → unwrap with PIN → decrypt with new key", async () => {
    const { key: vaultKey } = await setupVault("super-strong-passphrase");
    const cipher = await encryptText("the secret payload", vaultKey);

    const record = await wrapVaultKeyWithPin(vaultKey, "123456");
    expect(record.wrapped_b64).toBeTruthy();
    expect(record.salt_hex).toMatch(/^[0-9a-f]{32}$/);
    expect(record.iv_hex).toMatch(/^[0-9a-f]{24}$/);

    const unwrapped = await unwrapVaultKeyWithPin(record, "123456");
    expect(unwrapped).not.toBeNull();
    const plain = await decryptText(cipher, unwrapped!);
    expect(plain).toBe("the secret payload");
  });

  it("returns null for wrong PIN (no exception)", async () => {
    const { key } = await setupVault("phr");
    const record = await wrapVaultKeyWithPin(key, "1111");
    expect(await unwrapVaultKeyWithPin(record, "9999")).toBeNull();
  });

  it("each wrap uses a fresh salt + iv (no determinism across wraps)", async () => {
    const { key } = await setupVault("phr");
    const a = await wrapVaultKeyWithPin(key, "1234");
    const b = await wrapVaultKeyWithPin(key, "1234");
    expect(a.salt_hex).not.toBe(b.salt_hex);
    expect(a.iv_hex).not.toBe(b.iv_hex);
    expect(a.wrapped_b64).not.toBe(b.wrapped_b64);
  });
});

describe("Biometric wrap / unwrap (uses prf-derived material as wrapper key)", () => {
  it("round-trips with valid prf material", async () => {
    const { key: vaultKey } = await setupVault("phr");
    const cipher = await encryptText("biometric secret", vaultKey);
    const prfOutput = new Uint8Array(32);
    crypto.getRandomValues(prfOutput);

    const record = await wrapVaultKeyWithBiometricMaterial(vaultKey, prfOutput, "credid");
    expect(record.credential_id_b64).toBe("credid");

    const unwrapped = await unwrapVaultKeyWithBiometricMaterial(record, prfOutput);
    expect(unwrapped).not.toBeNull();
    expect(await decryptText(cipher, unwrapped!)).toBe("biometric secret");
  });

  it("rejects prf material shorter than 32 bytes", async () => {
    const { key } = await setupVault("phr");
    const tooShort = new Uint8Array(16);
    await expect(wrapVaultKeyWithBiometricMaterial(key, tooShort, "x")).rejects.toThrow();
  });

  it("returns null for mismatched prf material on unwrap", async () => {
    const { key } = await setupVault("phr");
    const a = new Uint8Array(32);
    const b = new Uint8Array(32);
    crypto.getRandomValues(a);
    crypto.getRandomValues(b);
    const record = await wrapVaultKeyWithBiometricMaterial(key, a, "cid");
    expect(await unwrapVaultKeyWithBiometricMaterial(record, b)).toBeNull();
  });
});

describe("localStorage persistence", () => {
  it("savePinRecord round-trips via loadPinRecord", () => {
    const rec = {
      wrapped_b64: "AAAA",
      salt_hex: "ab".repeat(16),
      iv_hex: "cd".repeat(12),
      configured_at: "2026-05-02T00:00:00.000Z",
    };
    savePinRecord(rec);
    expect(loadPinRecord()).toEqual(rec);
    clearPinRecord();
    expect(loadPinRecord()).toBeNull();
  });

  it("loadPinRecord returns null for missing or malformed entries", () => {
    expect(loadPinRecord()).toBeNull();
    localStorage.setItem("em_vault_pin_v1", "{not json}");
    expect(loadPinRecord()).toBeNull();
    localStorage.setItem("em_vault_pin_v1", JSON.stringify({ wrapped_b64: "x" })); // missing fields
    expect(loadPinRecord()).toBeNull();
  });

  it("biometric record round-trip", () => {
    const rec = {
      wrapped_b64: "BBBB",
      iv_hex: "ef".repeat(12),
      credential_id_b64: "cid-xyz",
      configured_at: "2026-05-02T00:00:00.000Z",
    };
    saveBiometricRecord(rec);
    expect(loadBiometricRecord()).toEqual(rec);
    clearBiometricRecord();
    expect(loadBiometricRecord()).toBeNull();
  });
});
