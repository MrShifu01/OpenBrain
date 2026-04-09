/**
 * Tests for brain API key hashing in api/brains.ts
 * - POST ?action=generate-api-key returns plaintext key starting with "ob_"
 * - The stored value is NOT the plaintext key (hash is stored)
 * - verifyBrainApiKey returns true for correct key, false for wrong key
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/_lib/verifyAuth.js", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
}));
vi.mock("../../api/_lib/rateLimit.js", () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../api/_lib/checkBrainAccess.js", () => ({
  checkBrainAccess: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../api/_lib/securityHeaders.js", () => ({
  applySecurityHeaders: vi.fn(),
}));

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
}

const BRAIN_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("api/brains — generate-api-key hashing", () => {
  let handler: (req: any, res: any) => Promise<void>;
  let verifyBrainApiKey: (key: string, hash: string, salt: string) => boolean;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let storedKeyData: any;

  beforeEach(async () => {
    vi.resetModules();

    vi.mock("../../api/_lib/verifyAuth.js", () => ({
      verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
    }));
    vi.mock("../../api/_lib/rateLimit.js", () => ({
      rateLimit: vi.fn().mockResolvedValue(true),
    }));
    vi.mock("../../api/_lib/securityHeaders.js", () => ({
      applySecurityHeaders: vi.fn(),
    }));

    storedKeyData = null;

    fetchSpy = vi.fn().mockImplementation((url: string, opts: any) => {
      // Owner check
      if (url.includes("brains?id=eq") && url.includes("owner_id=eq")) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([{ id: BRAIN_ID, name: "Test Brain" }]),
        });
      }
      // Key storage — capture what was stored
      if (url.includes("brain_api_keys") && opts?.method === "POST") {
        storedKeyData = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue([
            {
              id: "key-uuid-1",
              label: storedKeyData.label || "Default",
              created_at: new Date().toISOString(),
            },
          ]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const mod = await import("../../api/brains");
    handler = mod.default;
    verifyBrainApiKey = (mod as any).verifyBrainApiKey;
  });

  it("returns plaintext api_key starting with 'ob_' in response", async () => {
    const req = {
      method: "POST",
      query: { action: "generate-api-key" },
      headers: {},
      body: { brain_id: BRAIN_ID, label: "Test Key" },
    };
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.api_key).toBeDefined();
    expect(responseData.api_key).toMatch(/^ob_/);
  });

  it("stores api_key_hash and api_key_salt (not storing plaintext as only value)", async () => {
    const req = {
      method: "POST",
      query: { action: "generate-api-key" },
      headers: {},
      body: { brain_id: BRAIN_ID, label: "Secure Key" },
    };
    const res = makeRes();
    await handler(req, res);

    expect(storedKeyData).toBeDefined();
    // Hash and salt must be stored
    expect(storedKeyData.api_key_hash).toBeDefined();
    expect(storedKeyData.api_key_salt).toBeDefined();
    // The stored hash must NOT equal the plaintext key
    const returnedKey = res.json.mock.calls[0][0].api_key;
    expect(storedKeyData.api_key_hash).not.toBe(returnedKey);
    // Prefix should be stored for identification
    expect(storedKeyData.api_key_prefix).toBeDefined();
    expect(returnedKey.startsWith(storedKeyData.api_key_prefix)).toBe(true);
  });

  it("verifyBrainApiKey returns true for correct key, false for wrong key", () => {
    expect(verifyBrainApiKey).toBeDefined();

    // Use the real crypto module to create a hash
    const crypto = require("crypto");
    const salt = crypto.randomBytes(16).toString("hex");
    const key = "ob_testkey12345";
    const hash = crypto.scryptSync(key, salt, 32).toString("hex");

    expect(verifyBrainApiKey(key, hash, salt)).toBe(true);
    expect(verifyBrainApiKey("ob_wrongkey999", hash, salt)).toBe(false);
    expect(verifyBrainApiKey("", hash, salt)).toBe(false);
  });

  it("verifyBrainApiKey returns false on bad input without throwing", () => {
    expect(verifyBrainApiKey).toBeDefined();
    // Should not throw even with garbage input
    expect(() => verifyBrainApiKey("key", "not-a-valid-hex-hash", "salt")).not.toThrow();
  });
});
