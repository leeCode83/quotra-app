import { vi, describe, it, expect, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Patch TextEncoder to avoid cross-realm Uint8Array instanceof issues with jose
vi.hoisted(() => {
  const OriginalTextEncoder = globalThis.TextEncoder;
  globalThis.TextEncoder = class extends OriginalTextEncoder {
    encode(str: string): Uint8Array<ArrayBuffer> {
      const buf = super.encode(str);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
  } as typeof TextEncoder;
});

// Mock supabase-server BEFORE importing modules that use it
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase-server";
import { withAuth } from "@/middleware/auth";
import { withX402 } from "@/middleware/x402";
import { chain, withChain } from "@/middleware/chain";
import { signJWT } from "@/lib/jwt";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost:3000/api/test", {
    headers: new Headers(headers),
  }) as unknown as NextRequest;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

// ─── withAuth ────────────────────────────────────────────────────────────────

describe("withAuth", () => {
  const mockHandler = vi.fn<(...args: unknown[]) => Promise<Response>>();

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler.mockResolvedValue(jsonResponse({ ok: true }));
  });

  function validToken(wallet_address = "0x1234567890123456789012345678901234567890") {
    return signJWT({ wallet_address });
  }

  it("returns 401 when Authorization header is missing", async () => {
    const wrapped = withAuth(mockHandler);
    const res = await wrapped(createRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Missing Authorization header");
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is not Bearer", async () => {
    const wrapped = withAuth(mockHandler);
    const res = await wrapped(
      createRequest({ Authorization: "Basic dG9rZW4=" })
    );

    expect(res.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when token is empty after Bearer", async () => {
    const wrapped = withAuth(mockHandler);
    const res = await wrapped(createRequest({ Authorization: "Bearer " }));

    expect(res.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when JWT is invalid", async () => {
    const wrapped = withAuth(mockHandler);
    const res = await wrapped(
      createRequest({ Authorization: "Bearer definitely.not.a.valid.jwt" })
    );

    expect(res.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when token is missing wallet_address claim", async () => {
    const token = await signJWT({ sub: "no-wallet" } as never);
    const wrapped = withAuth(mockHandler);
    const res = await wrapped(
      createRequest({ Authorization: `Bearer ${token}` })
    );

    expect(res.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when wallet_address has invalid format", async () => {
    const token = await validToken("0xNOT_HEX");
    const wrapped = withAuth(mockHandler);
    const res = await wrapped(
      createRequest({ Authorization: `Bearer ${token}` })
    );

    expect(res.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("calls handler with auth context on valid JWT", async () => {
    const token = await validToken();
    const wrapped = withAuth(mockHandler);
    const res = await wrapped(
      createRequest({ Authorization: `Bearer ${token}` })
    );

    expect(res.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { wallet_address: "0x1234567890123456789012345678901234567890" },
      }),
      expect.objectContaining({
        wallet_address: "0x1234567890123456789012345678901234567890",
      })
    );
  });

  it("passes custom subject from signJWT", async () => {
    const token = await signJWT(
      { wallet_address: "0x1234567890123456789012345678901234567890" },
      "custom-sub"
    );
    const wrapped = withAuth(mockHandler);
    await wrapped(createRequest({ Authorization: `Bearer ${token}` }));

    expect(mockHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        wallet_address: "0x1234567890123456789012345678901234567890",
      })
    );
  });

  it("returns 500 when handler throws", async () => {
    mockHandler.mockRejectedValue(new Error("unexpected error"));
    const token = await validToken();
    const wrapped = withAuth(mockHandler);
    const res = await wrapped(
      createRequest({ Authorization: `Bearer ${token}` })
    );

    expect(res.status).toBe(500);
  });
});

// ─── withX402 ────────────────────────────────────────────────────────────────

describe("withX402", () => {
  const mockHandler = vi.fn<(...args: unknown[]) => Promise<Response>>();
  const mockSupabaseFrom = vi.fn();

  let mockSelect: ReturnType<typeof vi.fn>;
  let mockEq: ReturnType<typeof vi.fn>;
  let mockSingle: ReturnType<typeof vi.fn>;
  let mockInsert: ReturnType<typeof vi.fn>;

  function setupMockChain() {
    mockSingle = vi.fn();
    mockEq = vi.fn();
    mockSelect = vi.fn();
    mockInsert = vi.fn();

    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });

    mockSupabaseFrom.mockImplementation(() => ({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: mockInsert,
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler.mockResolvedValue(jsonResponse({ ok: true }));

    setupMockChain();

    // Default: no existing tx, consumer found
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null }) // no existing tx
      .mockResolvedValueOnce({
        data: { id: "consumer-1" },
        error: null,
      }); // consumer found
    mockInsert.mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      from: mockSupabaseFrom,
    } as never);
  });

  const validHeaders = {
    "x-listing-id": "550e8400-e29b-41d4-a716-446655440000",
    "x-amount": "100",
    "x-transaction-hash": "0xabc123def456",
    "x-signature": "sig-hello-world",
  };

  it("returns 402 when payment headers are missing", async () => {
    const wrapped = withX402(mockHandler);
    const res = await wrapped(createRequest({}));

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when amount is not a valid number", async () => {
    const wrapped = withX402(mockHandler);
    const res = await wrapped(
      createRequest({ ...validHeaders, "x-amount": "not-a-number" })
    );

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when amount is zero", async () => {
    const wrapped = withX402(mockHandler);
    const res = await wrapped(
      createRequest({ ...validHeaders, "x-amount": "0" })
    );

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when amount is negative", async () => {
    const wrapped = withX402(mockHandler);
    const res = await wrapped(
      createRequest({ ...validHeaders, "x-amount": "-50" })
    );

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when listing_id is invalid UUID", async () => {
    const wrapped = withX402(mockHandler);
    const res = await wrapped(
      createRequest({ ...validHeaders, "x-listing-id": "not-a-uuid" })
    );

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 409 when tx_hash already exists (replay protection)", async () => {
    setupMockChain();
    mockSingle.mockResolvedValueOnce({
      data: { id: "existing-tx", tx_hash: "0xabc123def456" },
      error: null,
    });

    const wrapped = withX402(mockHandler);
    const res = await wrapped(createRequest(validHeaders));

    expect(res.status).toBe(409);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when consumer not found", async () => {
    setupMockChain();
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null }) // no existing tx
      .mockResolvedValueOnce({ data: null, error: null }); // consumer not found

    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("calls handler with payment context when all validations pass", async () => {
    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({
          listing_id: "550e8400-e29b-41d4-a716-446655440000",
          amount: 100n,
          tx_hash: "0xabc123def456",
          signature: "sig-hello-world",
        }),
      }),
      expect.objectContaining({
        payment: expect.objectContaining({
          listing_id: "550e8400-e29b-41d4-a716-446655440000",
        }),
      })
    );
  });

  it("returns 500 when transaction insert fails", async () => {
    setupMockChain();
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null }) // no existing tx
      .mockResolvedValueOnce({ data: { id: "consumer-1" }, error: null }); // consumer found
    mockInsert.mockResolvedValue({ error: { code: "23503", message: "FK violation" } });

    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(500);
  });
});

// ─── chain ───────────────────────────────────────────────────────────────────

describe("chain", () => {
  it("throws when no middleware provided", () => {
    expect(() => chain([])).toThrow("At least one middleware must be provided");
  });

  it("short-circuits on first middleware that returns error response", async () => {
    const mw1 = vi.fn().mockResolvedValue(jsonResponse({ error: "fail" }, 401));
    const mw2 = vi.fn();

    const handler = chain([mw1, mw2]);
    const res = await handler(createRequest());

    expect(res.status).toBe(401);
    expect(mw2).not.toHaveBeenCalled();
  });

  it("passes through all middleware when none returns error", async () => {
    const mw1 = vi.fn().mockResolvedValue(jsonResponse({ ok: true }, 200));
    const mw2 = vi.fn().mockResolvedValue(jsonResponse({ ok: true }, 200));

    const handler = chain([mw1, mw2]);
    const res = await handler(createRequest());

    // chain() always returns 500 at end if no middleware fails
    expect(res.status).toBe(500);
    expect(mw1).toHaveBeenCalled();
    expect(mw2).toHaveBeenCalled();
  });
});

// ─── withChain ───────────────────────────────────────────────────────────────

describe("withChain", () => {
  const finalHandler = vi.fn<(...args: unknown[]) => Promise<Response>>();

  beforeEach(() => {
    vi.clearAllMocks();
    finalHandler.mockResolvedValue(jsonResponse({ success: true }));
  });

  it("calls final handler directly when no middleware provided", async () => {
    const handler = withChain([], finalHandler);
    const res = await handler(createRequest());

    expect(res.status).toBe(200);
    expect(finalHandler).toHaveBeenCalled();
  });

  it("short-circuits when middleware returns error", async () => {
    const mw = vi.fn().mockResolvedValue(jsonResponse({ error: "auth fail" }, 401));

    const handler = withChain([mw], finalHandler);
    const res = await handler(createRequest());

    expect(res.status).toBe(401);
    expect(finalHandler).not.toHaveBeenCalled();
  });

  it("calls final handler after all middleware pass", async () => {
    const mw = vi.fn().mockImplementation((req: Request, _ctx: never) => {
      void _ctx;
      // Add auth context to request for next middleware
      (req as { auth?: { wallet_address: string } }).auth = {
        wallet_address: "0x1234567890123456789012345678901234567890",
      };
      return jsonResponse({ ok: true });
    });

    const handler = withChain([mw], finalHandler);
    const res = await handler(createRequest());

    expect(res.status).toBe(200);
    expect(finalHandler).toHaveBeenCalled();
  });
});
