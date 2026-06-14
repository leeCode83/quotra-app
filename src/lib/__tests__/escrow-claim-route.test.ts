import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../../../app/api/escrow/claim/route";
import { createRouteClient } from "@/lib/route-client";

const mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";

vi.mock("@/lib/route-client", () => ({
  createRouteClient: vi.fn(() => ({
    supabase: createMockSupabase(),
    walletAddress: mockWalletAddress,
  })),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
}));

vi.mock("@/lib/oneshot/relayer-claim", () => ({
  claimViaPermissionlessRelayer: vi.fn(),
}));

function createChain(data: unknown) {
  const then = (resolve: (v: unknown) => void) => { resolve(data) }
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
  }
  return chain
}

function createMockSupabase() {
  return { from: vi.fn(() => createChain({ data: [], error: null })) }
}

describe("API /escrow/claim POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("returns 401 without wallet address", async () => {
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      supabase: createMockSupabase(),
      walletAddress: undefined,
    });

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 when provider not found", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from.mockReturnValueOnce(createChain({ data: null, error: { code: "PGRST116" } }));

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns skipped when claimable is zero", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from
      .mockReturnValueOnce(createChain({ data: { id: "p1", wallet_address: "0x...", pending_earnings_usdc: "0", total_earned_usdc: "0" }, error: null }))
      .mockReturnValueOnce(createChain({ data: [], error: null }))
      .mockReturnValueOnce(createChain({ data: [], error: null }));

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "POST" });
    const res = await POST(req);
    await expect(res.json()).resolves.toMatchObject({ status: "skipped", claimable_amount: 0 });
  });

  it("returns 502 when relayer claim fails", async () => {
    const { claimViaPermissionlessRelayer } = await import("@/lib/oneshot/relayer-claim");
    vi.mocked(claimViaPermissionlessRelayer).mockRejectedValueOnce(new Error("Relayer unavailable"));

    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from
      .mockReturnValueOnce(createChain({ data: { id: "p1", wallet_address: "0x...", pending_earnings_usdc: "10", total_earned_usdc: "0" }, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: "l1" }], error: null }))
      .mockReturnValueOnce(createChain({ data: [{ amount_usdc: "10" }], error: null }))
      .mockReturnValueOnce(createChain({ data: [], error: null }));

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("returns 200 with task_id on successful claim", async () => {
    const { claimViaPermissionlessRelayer } = await import("@/lib/oneshot/relayer-claim");
    vi.mocked(claimViaPermissionlessRelayer).mockResolvedValueOnce({ taskId: "0xabc123" });

    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from
      .mockReturnValueOnce(createChain({ data: { id: "p1", wallet_address: "0x...", pending_earnings_usdc: "10", total_earned_usdc: "0" }, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: "l1" }], error: null }))
      .mockReturnValueOnce(createChain({ data: [{ amount_usdc: "10" }], error: null }))
      .mockReturnValueOnce(createChain({ data: [], error: null }))
      .mockReturnValueOnce(createChain({ error: null }))
      .mockReturnValueOnce(createChain({ error: null }));

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task_id).toBe("0xabc123");
    expect(data.status).toBe("submitted");
    expect(data.claimable_amount).toBeGreaterThan(0);
  });
});

describe("API /escrow/claim GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("returns 401 without wallet address", async () => {
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      supabase: createMockSupabase(),
      walletAddress: undefined,
    });

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns empty claims when no provider found", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from.mockReturnValueOnce(createChain({ data: null, error: null }));

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    expect(body).toEqual({ claims: [] });
  });

  it("returns formatted claim history", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from
      .mockReturnValueOnce(createChain({ data: { id: "p1" }, error: null }))
      .mockReturnValueOnce(createChain({ data: [
        { id: "c1", provider_id: "p1", amount_usdc: "100.50", tx_hash: "0xabc", status: "completed", created_at: "2024-01-01T00:00:00Z" },
        { id: "c2", provider_id: "p1", amount_usdc: "50.25", tx_hash: "0xdef", status: "pending", created_at: "2024-01-02T00:00:00Z" },
      ], error: null }));

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    expect(body.claims).toHaveLength(2);
    expect(body.claims[0]).toEqual({
      id: "c1",
      provider_id: "p1",
      amount_usdc: 100.50,
      tx_hash: "0xabc",
      status: "claimed",
      created_at: "2024-01-01T00:00:00Z",
    });
    expect(body.claims[1]).toEqual({
      id: "c2",
      provider_id: "p1",
      amount_usdc: 50.25,
      tx_hash: "0xdef",
      status: "pending",
      created_at: "2024-01-02T00:00:00Z",
    });
  });

  it("returns empty claims on error", async () => {
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB error"));

    const req = new NextRequest("http://localhost/api/escrow/claim", { method: "GET" });
    const res = await GET(req);
    const body = await res.json();
    expect(body).toEqual({ claims: [] });
  });
});
