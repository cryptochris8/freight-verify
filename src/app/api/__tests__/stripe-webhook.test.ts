import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks (must be declared before any imports of the module under test) ──────

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  })),
  upsertSubscription: vi.fn(),
}));

// Chainable db mock ─ we expose the inner vi.fns so tests can override them.
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({
      set: mockUpdateSet.mockReturnValue({
        where: mockUpdateWhere.mockResolvedValue(undefined),
      }),
    })),
    select: vi.fn(() => ({
      from: mockSelectFrom.mockReturnValue({
        where: mockSelectWhere.mockReturnValue({
          limit: mockSelectLimit.mockResolvedValue([]),
        }),
      }),
    })),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  subscriptions: {},
  organizations: {},
  stripeWebhookEvents: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { headers } from "next/headers";
import { upsertSubscription } from "@/lib/stripe/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body = "body-text"): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    body,
  });
}

function mockHeaders(sig: string | null) {
  vi.mocked(headers).mockResolvedValue({
    get: (key: string) => (key === "stripe-signature" ? sig : null),
  } as never);
}

function makeStripeEvent(type: string, data: object, id = "evt_test_123"): object {
  return { id, type, data: { object: data } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/stripe", () => {
  const ORIGINAL_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

    // Default: insert resolves (no duplicate)
    mockInsertValues.mockResolvedValue(undefined);

    // Default: select returns empty array
    mockSelectLimit.mockResolvedValue([]);

    // Default: update chain resolves
    mockUpdateWhere.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_WEBHOOK_SECRET;
  });

  // ── 1. Missing stripe-signature header ──────────────────────────────────────
  it("returns 400 when stripe-signature header is missing", async () => {
    mockHeaders(null);

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Missing stripe-signature header");
  });

  // ── 2. Missing STRIPE_WEBHOOK_SECRET env var ─────────────────────────────────
  it("returns 500 when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    mockHeaders("sig_valid");

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Webhook secret not configured");
  });

  // ── 3. Invalid Stripe signature ──────────────────────────────────────────────
  it("returns 400 when signature verification fails", async () => {
    mockHeaders("sig_bad");
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid signature");
  });

  // ── 4. Duplicate / already-processed event (idempotency) ────────────────────
  it("returns { received: true } when event was already processed (unique constraint violation)", async () => {
    mockHeaders("sig_valid");
    mockConstructEvent.mockReturnValue(
      makeStripeEvent("some.event", { id: "already_seen" })
    );
    mockInsertValues.mockRejectedValue(new Error("unique constraint violation – 23505"));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
  });

  // ── 5. checkout.session.completed ───────────────────────────────────────────
  it("handles checkout.session.completed and calls upsertSubscription", async () => {
    mockHeaders("sig_valid");

    const fakeStripeSubscription = { id: "sub_abc", status: "active" };
    mockSubscriptionsRetrieve.mockResolvedValue(fakeStripeSubscription);

    const session = {
      metadata: { orgId: "org-1", tier: "professional" },
      subscription: "sub_abc",
    };
    mockConstructEvent.mockReturnValue(
      makeStripeEvent("checkout.session.completed", session)
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_abc");
    expect(vi.mocked(upsertSubscription)).toHaveBeenCalledWith(
      "org-1",
      fakeStripeSubscription,
      "professional"
    );
  });

  // ── 6. customer.subscription.updated ────────────────────────────────────────
  it("handles customer.subscription.updated and calls upsertSubscription", async () => {
    mockHeaders("sig_valid");

    const stripeSubscription = {
      id: "sub_upd",
      status: "active",
      metadata: { orgId: "org-2", tier: "business" },
    };
    mockConstructEvent.mockReturnValue(
      makeStripeEvent("customer.subscription.updated", stripeSubscription)
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    expect(vi.mocked(upsertSubscription)).toHaveBeenCalledWith(
      "org-2",
      stripeSubscription,
      "business"
    );
  });

  // ── 7. customer.subscription.deleted ────────────────────────────────────────
  it("handles customer.subscription.deleted — updates subscription to canceled and org to starter", async () => {
    mockHeaders("sig_valid");

    const stripeSubscription = {
      id: "sub_del",
      status: "canceled",
      metadata: { orgId: "org-3" },
    };
    mockConstructEvent.mockReturnValue(
      makeStripeEvent("customer.subscription.deleted", stripeSubscription)
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const { db } = await import("@/lib/db");
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    // Two db.update calls: one for subscriptions, one for organizations
    expect(vi.mocked(db.update)).toHaveBeenCalledTimes(2);

    // First update sets status to canceled
    const firstSetCall = mockUpdateSet.mock.calls[0][0];
    expect(firstSetCall).toMatchObject({ status: "canceled" });

    // Second update sets plan to starter
    const secondSetCall = mockUpdateSet.mock.calls[1][0];
    expect(secondSetCall).toMatchObject({ plan: "starter", verifiedLoadsLimit: 50 });
  });

  // ── 8. Unhandled event type ──────────────────────────────────────────────────
  it("returns { received: true } for unhandled event types", async () => {
    mockHeaders("sig_valid");
    mockConstructEvent.mockReturnValue(
      makeStripeEvent("payment_intent.created", { id: "pi_xyz" })
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    // upsertSubscription must NOT have been called for an unknown event
    expect(vi.mocked(upsertSubscription)).not.toHaveBeenCalled();
  });

  // ── 9. Handler throws → 500 ──────────────────────────────────────────────────
  it("returns 500 when the event handler throws", async () => {
    mockHeaders("sig_valid");

    // Use checkout.session.completed and make subscriptions.retrieve blow up
    const session = {
      metadata: { orgId: "org-err", tier: "professional" },
      subscription: "sub_err",
    };
    mockConstructEvent.mockReturnValue(
      makeStripeEvent("checkout.session.completed", session)
    );
    mockSubscriptionsRetrieve.mockRejectedValue(new Error("Stripe API unavailable"));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Webhook handler failed");
  });
});
