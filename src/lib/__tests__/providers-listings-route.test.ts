import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../../app/api/providers/listings/route";
import { PATCH } from "../../../app/api/providers/listings/[listingId]/route";
import { supabaseAdmin } from "@/lib/supabase-admin";

const mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";

vi.mock("@/lib/route-client", () => ({
  createRouteClient: vi.fn(() => ({
    supabase: { from: vi.fn() },
    walletAddress: mockWalletAddress,
  })),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn().mockResolvedValue({
    encrypted_key: "enc_key",
    key_iv: "iv",
    key_auth_tag: "tag",
  }),
}));

describe("API /providers/listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST", () => {
    it("returns 400 for invalid body schema", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("PATCH /providers/listings/[listingId]", () => {
    it("returns 400 for invalid schema", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings/123", {
        method: "PATCH",
        body: JSON.stringify({ status: "invalid_status" }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ listingId: "123" }) });
      expect(res.status).toBe(400);
    });

    it("returns 404 if listing not found", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings/123", {
        method: "PATCH",
        body: JSON.stringify({ status: "paused" }),
      });

      (supabaseAdmin.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ error: { message: "Not found" } }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ listingId: "123" }) });
      expect(res.status).toBe(404);
    });

    it("updates listing successfully", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings/123", {
        method: "PATCH",
        body: JSON.stringify({ status: "paused" }),
      });

      const mockSelectSingle = vi.fn().mockResolvedValue({
        data: {
          id: "123",
          providers: { wallet_address: "0x1234567890abcdef1234567890abcdef12345678" },
        },
        error: null,
      });

      (supabaseAdmin.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => {
          return { single: mockSelectSingle };
        }),
      }));

      (supabaseAdmin.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

      const res = await PATCH(req, { params: Promise.resolve({ listingId: "123" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
