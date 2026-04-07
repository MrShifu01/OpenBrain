import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/_lib/verifyAuth.js", () => ({ verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }) }));
vi.mock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeReq(overrides: any = {}) {
  return {
    method: "POST", query: { action: "setup" },
    headers: { authorization: "Bearer test" },
    body: { hash: "a".repeat(64), salt: "b".repeat(32) },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  };
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
}

beforeEach(() => { mockFetch.mockReset(); });

describe("POST /api/pin?action=setup", () => {
  it("stores hash and salt, returns ok", async () => {
    vi.resetModules();
    vi.mock("../../api/_lib/verifyAuth.js", () => ({ verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }) }));
    vi.mock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
    vi.mock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const { default: handler } = await import("../../api/pin.js");
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("rejects invalid hash (not 64 hex chars)", async () => {
    vi.resetModules();
    vi.mock("../../api/_lib/verifyAuth.js", () => ({ verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }) }));
    vi.mock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
    vi.mock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));
    const { default: handler } = await import("../../api/pin.js");
    const res = makeRes();
    await handler(makeReq({ body: { hash: "short", salt: "b".repeat(32) } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects invalid salt", async () => {
    vi.resetModules();
    vi.mock("../../api/_lib/verifyAuth.js", () => ({ verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }) }));
    vi.mock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
    vi.mock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));
    const { default: handler } = await import("../../api/pin.js");
    const res = makeRes();
    await handler(makeReq({ body: { hash: "a".repeat(64), salt: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("POST /api/pin?action=verify", () => {
  it("returns valid:true when hash matches", async () => {
    vi.resetModules();
    vi.mock("../../api/_lib/verifyAuth.js", () => ({ verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }) }));
    vi.mock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
    vi.mock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));
    const hash = "a".repeat(64);
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ pin_hash: hash }] });
    const { default: handler } = await import("../../api/pin.js");
    const res = makeRes();
    await handler(makeReq({ query: { action: "verify" }, body: { hash } }), res);
    expect(res.json).toHaveBeenCalledWith({ valid: true });
  });

  it("returns valid:false when hash doesn't match", async () => {
    vi.resetModules();
    vi.mock("../../api/_lib/verifyAuth.js", () => ({ verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }) }));
    vi.mock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
    vi.mock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ pin_hash: "b".repeat(64) }] });
    const { default: handler } = await import("../../api/pin.js");
    const res = makeRes();
    await handler(makeReq({ query: { action: "verify" }, body: { hash: "a".repeat(64) } }), res);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
  });

  it("returns noPinSet when no record", async () => {
    vi.resetModules();
    vi.mock("../../api/_lib/verifyAuth.js", () => ({ verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }) }));
    vi.mock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
    vi.mock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const { default: handler } = await import("../../api/pin.js");
    const res = makeRes();
    await handler(makeReq({ query: { action: "verify" }, body: { hash: "a".repeat(64) } }), res);
    expect(res.json).toHaveBeenCalledWith({ valid: false, noPinSet: true });
  });
});

describe("DELETE /api/pin?action=delete", () => {
  it("clears pin_hash and returns ok", async () => {
    vi.resetModules();
    vi.mock("../../api/_lib/verifyAuth.js", () => ({ verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }) }));
    vi.mock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
    vi.mock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const { default: handler } = await import("../../api/pin.js");
    const res = makeRes();
    await handler(makeReq({ method: "DELETE", query: { action: "delete" }, body: {} }), res);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
