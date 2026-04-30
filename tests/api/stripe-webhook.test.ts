import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env vars before any imports
process.env.VITE_SUPABASE_URL = "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-key";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

const mockConstructEvent = vi.fn();
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

type ReqOverrides = Record<string, unknown>;

function makeReq(overrides: ReqOverrides = {}) {
  return {
    method: "POST",
    query: { resource: "stripe-webhook" },
    headers: { "stripe-signature": "sig_test" },
    body: {},
    socket: { remoteAddress: "127.0.0.1" },
    on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
      if (event === "data") cb(Buffer.from(JSON.stringify({ id: "evt_1" })));
      if (event === "end") cb();
    }),
    ...overrides,
  };
}

interface MockRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
}

function makeRes(): MockRes {
  const res = {} as MockRes;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
}

beforeEach(() => {
  mockConstructEvent.mockReset();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

async function setupHandler() {
  vi.resetModules();
  vi.doMock("../../api/_lib/stripe.js", () => ({
    stripe: { webhooks: { constructEvent: mockConstructEvent } },
  }));
  vi.doMock("../../api/_lib/sbHeaders.js", () => ({
    sbHeaders: () => ({ "Content-Type": "application/json" }),
  }));
  vi.doMock("../../api/_lib/securityHeaders.js", () => ({ applySecurityHeaders: vi.fn() }));
  vi.doMock("../../api/_lib/verifyAuth.js", () => ({
    verifyAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
  }));
  vi.doMock("../../api/_lib/rateLimit.js", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
  return (await import("../../api/user-data.js")).default;
}

describe("stripe-webhook handler", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const handler = await setupHandler();
    const req = makeReq({ headers: {} });
    const res = makeRes();
    await handler(
      req as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const handler = await setupHandler();
    const req = makeReq();
    const res = makeRes();
    await handler(
      req as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid signature" });
  });

  it("sets tier=pro on customer.subscription.created with pro price", async () => {
    process.env.STRIPE_PRO_PRICE_ID = "price_pro_monthly";
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_abc",
          current_period_end: 1800000000,
          items: { data: [{ price: { id: "price_pro_monthly" }, current_period_end: 1800000000 }] },
        },
      },
    });
    const handler = await setupHandler();
    await handler(
      makeReq() as Parameters<typeof handler>[0],
      makeRes() as unknown as Parameters<typeof handler>[1],
    );
    const patchCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("stripe_customer_id=eq.cus_abc"),
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body);
    expect(body.tier).toBe("pro");
    expect(body.stripe_subscription_id).toBe("sub_123");
    expect(body.tier_expires_at).toBeNull();
  });

  it("sets tier=starter on customer.subscription.created with starter price", async () => {
    process.env.STRIPE_PRO_PRICE_ID = "price_pro_monthly";
    process.env.STRIPE_STARTER_PRICE_ID = "price_starter_monthly";
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_456",
          customer: "cus_def",
          current_period_end: 1800000000,
          items: {
            data: [{ price: { id: "price_starter_monthly" }, current_period_end: 1800000000 }],
          },
        },
      },
    });
    const handler = await setupHandler();
    await handler(
      makeReq() as Parameters<typeof handler>[0],
      makeRes() as unknown as Parameters<typeof handler>[1],
    );
    const patchCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("stripe_customer_id=eq.cus_def"),
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body);
    expect(body.tier).toBe("starter");
    expect(body.stripe_subscription_id).toBe("sub_456");
    expect(body.tier_expires_at).toBeNull();
  });

  it("sets tier=free and tier_expires_at on customer.subscription.deleted", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_789",
          customer: "cus_ghi",
          current_period_end: 1800000000,
          items: { data: [{ price: { id: "price_pro_monthly" }, current_period_end: 1800000000 }] },
        },
      },
    });
    const handler = await setupHandler();
    await handler(
      makeReq() as Parameters<typeof handler>[0],
      makeRes() as unknown as Parameters<typeof handler>[1],
    );
    const patchCall = mockFetch.mock.calls.find((c) =>
      (c[0] as string).includes("stripe_customer_id=eq.cus_ghi"),
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1].body);
    expect(body.tier).toBe("free");
    expect(body.stripe_subscription_id).toBeNull();
    expect(body.tier_expires_at).not.toBeNull();
  });

  it("returns 200 { received: true } on success", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed", // unhandled type — should still return 200
      data: { object: {} },
    });
    const handler = await setupHandler();
    const res = makeRes();
    await handler(
      makeReq() as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
