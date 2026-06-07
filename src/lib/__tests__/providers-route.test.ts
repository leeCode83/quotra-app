import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../../../app/api/providers/route";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Mock supabaseAdmin
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe("API /providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST", () => {
    it("returns 401 if x-wallet-address is missing", async () => {
      const req = new NextRequest("http://localhost/api/providers", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/Unauthorized/);
    });

    it("returns 400 if wallet address format is invalid", async () => {
      const req = new NextRequest("http://localhost/api/providers", {
        method: "POST",
        headers: { "x-wallet-address": "invalid_address" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 200 with alreadyRegistered true if provider exists", async () => {
      const req = new NextRequest("http://localhost/api/providers", {
        method: "POST",
        headers: { "x-wallet-address": "0x1234567890abcdef1234567890abcdef12345678" },
      });

      const mockSelect = vi.fn().mockReturnThis();
      const mockIlike = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: "123", wallet_address: "0x1234567890abcdef1234567890abcdef12345678" },
      });

      (supabaseAdmin.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
        ilike: mockIlike,
        maybeSingle: mockMaybeSingle,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.alreadyRegistered).toBe(true);
    });

    it("returns 201 if provider is successfully created", async () => {
      const req = new NextRequest("http://localhost/api/providers", {
        method: "POST",
        headers: { "x-wallet-address": "0x1234567890abcdef1234567890abcdef12345678" },
      });

      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelectSingle = vi.fn().mockResolvedValue({
        data: { id: "123", wallet_address: "0x1234567890abcdef1234567890abcdef12345678" },
        error: null,
      });

      (supabaseAdmin.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
        insert: mockInsert,
        single: mockSelectSingle,
      }));

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.alreadyRegistered).toBe(false);
      expect(data.provider.id).toBe("123");
    });
  });

  describe("GET", () => {
    it("returns 401 if x-wallet-address is missing", async () => {
      const req = new NextRequest("http://localhost/api/providers");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns 404 if provider is not found", async () => {
      const req = new NextRequest("http://localhost/api/providers", {
        headers: { "x-wallet-address": "0x1234567890abcdef1234567890abcdef12345678" },
      });

      (supabaseAdmin.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ error: { code: "PGRST116" } }),
      });

      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it("returns provider data successfully", async () => {
      const req = new NextRequest("http://localhost/api/providers", {
        headers: { "x-wallet-address": "0x1234567890abcdef1234567890abcdef12345678" },
      });

      (supabaseAdmin.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "123", wallet_address: "0x..." },
          error: null,
        }),
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.provider.id).toBe("123");
    });
  });
});
