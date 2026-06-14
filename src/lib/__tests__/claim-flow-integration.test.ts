import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as ClaimPost } from "../../../app/api/escrow/claim/route";
import { POST as WebhookPost } from "../../../app/api/webhooks/relayer/route";

const mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";

const sharedSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/route-client", () => ({
  createRouteClient: vi.fn(() => ({
    supabase: sharedSupabase,
    walletAddress: mockWalletAddress,
  })),
  unauthorized: vi.fn(
    () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  ),
}));

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(() => sharedSupabase),
}));

vi.mock("@/lib/oneshot/relayer-claim", () => ({
  claimViaPermissionlessRelayer: vi.fn(),
}));

vi.mock("@/lib/oneshot", () => ({
  verifyRelayerWebhook: vi.fn().mockResolvedValue(true),
}));

function createChain(data: unknown) {
  const then = (resolve: (v: unknown) => void) => {
    resolve(data);
  };
  const chain = {
    select: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    in: vi.fn(() => chain),
    single: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    then,
  };
  return chain;
}

describe("Claim flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("completes full claim lifecycle through to successful webhook confirmation", async () => {
    const { claimViaPermissionlessRelayer } = await import(
      "@/lib/oneshot/relayer-claim"
    );
    vi.mocked(claimViaPermissionlessRelayer).mockResolvedValue({
      taskId: "task-claim-123",
    });

    const providerData = {
      id: "p1",
      wallet_address: mockWalletAddress,
      pending_earnings_usdc: "10",
      total_earned_usdc: "0",
    };
    const claimInsertChain = createChain({ error: null });

    sharedSupabase.from
      .mockReturnValueOnce(createChain({ data: providerData, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: "l1" }], error: null }))
      .mockReturnValueOnce(
        createChain({ data: [{ amount_usdc: "10" }], error: null })
      )
      .mockReturnValueOnce(createChain({ data: [], error: null }))
      .mockReturnValueOnce(claimInsertChain)
      .mockReturnValueOnce(createChain({ error: null }));

    const req = new NextRequest("http://localhost/api/escrow/claim", {
      method: "POST",
    });
    const res = await ClaimPost(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task_id).toBe("task-claim-123");
    expect(data.status).toBe("submitted");
    expect(data.claimable_amount).toBeGreaterThan(0);

    expect(claimViaPermissionlessRelayer).toHaveBeenCalledWith(
      mockWalletAddress,
      BigInt(9000000),
      "http://localhost:3000/api/webhooks/relayer"
    );

    expect(claimInsertChain.insert).toHaveBeenCalledWith({
      provider_id: "p1",
      amount_usdc: "9",
      task_id: "task-claim-123",
      status: "pending",
    });
  });

  it("webhook type 4 stores tx_hash for the claim", async () => {
    const webhookChain = createChain({ error: null });
    sharedSupabase.from.mockReturnValueOnce(webhookChain);

    const req = new NextRequest("http://localhost/api/webhooks/relayer", {
      method: "POST",
      body: JSON.stringify({
        apiVersion: 0,
        type: 4,
        data: { id: "task-claim-123", status: 110, hash: "0xabc" },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      }),
    });
    const res = await WebhookPost(req);

    expect(webhookChain.update).toHaveBeenCalledWith({ tx_hash: "0xabc" });
    expect(webhookChain.eq).toHaveBeenCalledWith("task_id", "task-claim-123");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it("webhook type 0 sets claim status to completed", async () => {
    const webhookChain = createChain({ error: null });
    sharedSupabase.from.mockReturnValueOnce(webhookChain);

    const req = new NextRequest("http://localhost/api/webhooks/relayer", {
      method: "POST",
      body: JSON.stringify({
        apiVersion: 0,
        type: 0,
        data: { id: "task-claim-123", status: 200, hash: "0xdef" },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      }),
    });
    const res = await WebhookPost(req);

    expect(webhookChain.update).toHaveBeenCalledWith({
      status: "completed",
      tx_hash: "0xdef",
    });
    expect(webhookChain.eq).toHaveBeenCalledWith("task_id", "task-claim-123");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it("webhook type 1 sets claim status to failed", async () => {
    const webhookChain = createChain({ error: null });
    sharedSupabase.from.mockReturnValueOnce(webhookChain);

    const req = new NextRequest("http://localhost/api/webhooks/relayer", {
      method: "POST",
      body: JSON.stringify({
        apiVersion: 0,
        type: 1,
        data: { id: "task-claim-123", status: 400 },
        timestamp: 1,
        keyId: "k1",
        signature: "sig",
      }),
    });
    const res = await WebhookPost(req);

    expect(webhookChain.update).toHaveBeenCalledWith({
      status: "failed",
      tx_hash: undefined,
    });
    expect(webhookChain.eq).toHaveBeenCalledWith("task_id", "task-claim-123");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it("returns 502 when relayer claim fails", async () => {
    const { claimViaPermissionlessRelayer } = await import(
      "@/lib/oneshot/relayer-claim"
    );
    vi.mocked(claimViaPermissionlessRelayer).mockRejectedValue(
      new Error("Relayer unavailable")
    );

    sharedSupabase.from
      .mockReturnValueOnce(
        createChain({
          data: {
            id: "p1",
            wallet_address: mockWalletAddress,
            pending_earnings_usdc: "10",
            total_earned_usdc: "0",
          },
          error: null,
        })
      )
      .mockReturnValueOnce(createChain({ data: [{ id: "l1" }], error: null }))
      .mockReturnValueOnce(
        createChain({ data: [{ amount_usdc: "10" }], error: null })
      )
      .mockReturnValueOnce(createChain({ data: [], error: null }));

    const req = new NextRequest("http://localhost/api/escrow/claim", {
      method: "POST",
    });
    const res = await ClaimPost(req);

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe("USDC transfer failed");
  });
});
