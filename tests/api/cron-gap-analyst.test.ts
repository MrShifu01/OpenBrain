/**
 * S6-3: Gap analyst cron — weekly scan for knowledge gaps per brain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

function makeReq(overrides: Record<string, any> = {}) {
  return {
    method: "GET",
    query: {},
    headers: {},
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

vi.mock("../../api/_lib/securityHeaders.js", () => ({
  applySecurityHeaders: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
  process.env.SUPABASE_URL = "https://sb.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  delete process.env.NODE_ENV;
  delete process.env.VERCEL_ENV;
});

describe("gap analyst cron (S6-3)", () => {
  it("returns 200 with gaps analysis", async () => {
    // brains fetch
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "brain-1", owner_id: "user-1", name: "Test Brain" }],
      })
      // entries fetch for brain-1
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "e1", title: "Burger Recipe", tags: ["recipe", "burger"] },
          { id: "e2", title: "Staff Schedule", tags: ["staff"] },
        ],
        headers: { get: () => "0/2" },
      })
      // gap_log insert
      .mockResolvedValue({ ok: true, json: async () => [], text: async () => "" });

    const handler = (await import("../../api/cron/gap-analyst")).default;
    const req = makeReq();
    const res = makeRes();
    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.ok).toBe(true);
    expect(typeof result.processed).toBe("number");
  });

  it("blocks non-cron requests in production", async () => {
    process.env.NODE_ENV = "production";
    const handler = (await import("../../api/cron/gap-analyst")).default;
    const req = makeReq({ headers: {} }); // no x-vercel-cron
    const res = makeRes();
    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
