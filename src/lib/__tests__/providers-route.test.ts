import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../../../app/api/providers/route";
import { createRouteClient } from "@/lib/route-client";

const mockSupabase = {
  from: vi.fn(),
};

const mockWalletAddress = "0x1234567890abcdef1234567890abcdef12345678";

vi.mock("@/lib/route-client", () => ({
  createRouteClient: vi.fn(() => ({
    supabase: mockSupabase,
    walletAddress: mockWalletAddress,
  })),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
}));

describe("API /providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST", () => {
    it("returns 400 if wallet address format is invalid", async () => {
      (createRouteClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        supabase: mockSupabase,
        walletAddress: "invalid_address",
      });

      const req = new NextRequest("http://localhost/api/providers", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 200 with alreadyRegistered true if provider exists", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockIlike = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: "123", wallet_address: "0x1234567890abcdef1234567890abcdef12345678" },
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        ilike: mockIlike,
        maybeSingle: mockMaybeSingle,
      });

      const req = new NextRequest("http://localhost/api/providers", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.alreadyRegistered).toBe(true);
    });

    it("returns 201 if provider is successfully created", async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelectSingle = vi.fn().mockResolvedValue({
        data: { id: "123", wallet_address: "0x1234567890abcdef1234567890abcdef12345678" },
        error: null,
      });

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
        insert: mockInsert,
        single: mockSelectSingle,
      }));

      const req = new NextRequest("http://localhost/api/providers", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.alreadyRegistered).toBe(false);
      expect(data.provider.id).toBe("123");
    });
  });

  describe("GET", () => {
    it("returns 404 if provider is not found", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ error: { code: "PGRST116" } }),
      });

      const req = new NextRequest("http://localhost/api/providers");
      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it("returns provider data successfully", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "123", wallet_address: "0x..." },
          error: null,
        }),
      });

      const req = new NextRequest("http://localhost/api/providers");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.provider.id).toBe("123");
    });
  });
});
