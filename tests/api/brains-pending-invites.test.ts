/**
 * S5-1: Tests for brain collaboration UI — pending invites endpoint.
 * GET  /api/brains?action=pending-invites&brain_id=...
 * DELETE /api/brains?action=revoke-invite&brain_id=...&invite_id=...
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const BRAIN_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeReq(overrides: Record<string, any> = {}) {
  return {
    method: "GET",
    query: {},
    headers: { authorization: "Bearer token" },
    body: {},
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

vi.mock("../../api/_lib/verifyAuth.js", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

vi.mock("../../api/_lib/rateLimit.js", () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../api/_lib/checkBrainAccess.js", () => ({
  checkBrainAccess: vi.fn().mockResolvedValue({ role: "owner" }),
}));

vi.mock("../../api/_lib/securityHeaders.js", () => ({
  applySecurityHeaders: vi.fn(),
}));

const pendingInvites = [
  { id: "inv-1", email: "alice@example.com", role: "member", created_at: "2026-01-01T00:00:00Z" },
  { id: "inv-2", email: "bob@example.com", role: "viewer", created_at: "2026-01-02T00:00:00Z" },
];

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
});

describe("GET /api/brains?action=pending-invites (S5-1)", () => {
  it("returns list of pending invites for brain owners", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => pendingInvites,
      text: async () => "",
    });

    const handler = (await import("../../api/brains")).default;
    const req = makeReq({ query: { action: "pending-invites", brain_id: BRAIN_ID } });
    const res = makeRes();
    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0].email).toBe("alice@example.com");
  });

  it("returns 400 when brain_id is missing", async () => {
    const handler = (await import("../../api/brains")).default;
    const req = makeReq({ query: { action: "pending-invites" } });
    const res = makeRes();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("DELETE /api/brains?action=revoke-invite (S5-1)", () => {
  it("revokes a pending invite by invite_id", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => "",
    });

    const handler = (await import("../../api/brains")).default;
    const req = makeReq({
      method: "DELETE",
      query: { action: "revoke-invite" },
      body: { brain_id: BRAIN_ID, invite_id: "inv-1" },
    });
    const res = makeRes();
    await handler(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    // Verify DELETE was called against brain_invites
    const deleteCall = mockFetch.mock.calls.find(([url]: [string]) =>
      url.includes("brain_invites") && url.includes("inv-1")
    );
    expect(deleteCall).toBeDefined();
  });

  it("returns 400 when invite_id is missing", async () => {
    const handler = (await import("../../api/brains")).default;
    const req = makeReq({
      method: "DELETE",
      query: { action: "revoke-invite" },
      body: { brain_id: BRAIN_ID },
    });
    const res = makeRes();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
