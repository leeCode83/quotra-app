import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../../app/api/escrow/revoke/route";
import { createRouteClient } from "@/lib/route-client";

const mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";

vi.mock("@/lib/route-client", () => ({
  createRouteClient: vi.fn(() => ({
    supabase: createMockSupabase(),
    walletAddress: mockWalletAddress,
  })),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
}));

function createChain(data: unknown) {
  const then = (resolve: (v: unknown) => void) => { resolve(data) }
  const chain = {
    select: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
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

describe("API /escrow/revoke POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("returns 401 without wallet address", async () => {
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      supabase: createMockSupabase(),
      walletAddress: undefined,
    });

    const req = new NextRequest("http://localhost/api/escrow/revoke", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing listing_id", async () => {
    const req = new NextRequest("http://localhost/api/escrow/revoke", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 404 when provider not found", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from.mockReturnValueOnce(createChain({ data: null, error: { code: "PGRST116" } }));

    const req = new NextRequest("http://localhost/api/escrow/revoke", {
      method: "POST",
      body: JSON.stringify({ listing_id: "l1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 when listing not found", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from
      .mockReturnValueOnce(createChain({ data: { id: "p1" }, error: null }))
      .mockReturnValueOnce(createChain({ data: null, error: { code: "PGRST116" } }));

    const req = new NextRequest("http://localhost/api/escrow/revoke", {
      method: "POST",
      body: JSON.stringify({ listing_id: "l1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when not listing owner", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from
      .mockReturnValueOnce(createChain({ data: { id: "p1" }, error: null }))
      .mockReturnValueOnce(createChain({ data: { provider_id: "p999", status: "active" }, error: null }));

    const req = new NextRequest("http://localhost/api/escrow/revoke", {
      method: "POST",
      body: JSON.stringify({ listing_id: "l1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 410 when listing already revoked", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from
      .mockReturnValueOnce(createChain({ data: { id: "p1" }, error: null }))
      .mockReturnValueOnce(createChain({ data: { provider_id: "p1", status: "revoked" }, error: null }));

    const req = new NextRequest("http://localhost/api/escrow/revoke", {
      method: "POST",
      body: JSON.stringify({ listing_id: "l1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
  });

  it("returns 200 on successful revoke", async () => {
    const supabase = createMockSupabase();
    (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ supabase, walletAddress: mockWalletAddress });
    supabase.from
      .mockReturnValueOnce(createChain({ data: { id: "p1" }, error: null }))
      .mockReturnValueOnce(createChain({ data: { provider_id: "p1", status: "active" }, error: null }))
      .mockReturnValueOnce(createChain({ error: null }));

    const req = new NextRequest("http://localhost/api/escrow/revoke", {
      method: "POST",
      body: JSON.stringify({ listing_id: "l1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ listingId: "l1", status: "revoked" });
  });
});
