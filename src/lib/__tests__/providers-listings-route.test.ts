import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../../app/api/providers/listings/route";
import { PATCH } from "../../../app/api/providers/listings/[listingId]/route";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Mock dependencies
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn().mockResolvedValue({
    encrypted_key: "enc_key",
    key_iv: "iv",
    key_auth_tag: "tag",
  }),
}));

vi.mock("@/lib/oneshot", () => ({
  executeAsDelegator: vi.fn().mockResolvedValue(true),
}));

describe("API /providers/listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST", () => {
    it("returns 401 if x-wallet-address is missing", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid body schema", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings", {
        method: "POST",
        headers: { "x-wallet-address": "0x1234567890abcdef1234567890abcdef12345678" },
        body: JSON.stringify({}), // Empty body violates createListingSchema
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Validation failed");
    });
  });

  describe("PATCH /providers/listings/[listingId]", () => {
    it("returns 401 if wallet missing", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings/123", {
        method: "PATCH",
      });
      const res = await PATCH(req, { params: Promise.resolve({ listingId: "123" }) });
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid schema", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings/123", {
        method: "PATCH",
        headers: { "x-wallet-address": "0x1234567890abcdef1234567890abcdef12345678" },
        body: JSON.stringify({ status: "invalid_status" }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ listingId: "123" }) });
      expect(res.status).toBe(400);
    });

    it("returns 404 if listing not found", async () => {
      const req = new NextRequest("http://localhost/api/providers/listings/123", {
        method: "PATCH",
        headers: { "x-wallet-address": "0x1234567890abcdef1234567890abcdef12345678" },
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
        headers: { "x-wallet-address": "0x1234567890abcdef1234567890abcdef12345678" },
        body: JSON.stringify({ status: "paused" }),
      });


      const mockSelectSingle = vi.fn().mockResolvedValue({
        data: {
          id: "123",
          providers: { wallet_address: "0x1234567890abcdef1234567890abcdef12345678" },
        },
        error: null,
      });

      const mockUpdate = vi.fn().mockReturnThis();
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

      (supabaseAdmin.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col) => {
          if (col === "id" && !mockUpdate.mock.calls.length) {
            return { single: mockSelectSingle };
          }
          return mockUpdateEq;
        }),
        update: mockUpdate,
      }));

      const res = await PATCH(req, { params: Promise.resolve({ listingId: "123" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
