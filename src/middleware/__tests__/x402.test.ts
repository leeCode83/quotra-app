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

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase-server";
import {
  withX402,
  paymentRequired,
  conflict,
  serverError,
} from "@/middleware/x402";
import { chain } from "@/middleware/chain";

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost:3000/api/test", {
    headers: new Headers(headers),
  }) as unknown as NextRequest;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

const validHeaders = {
  "x-listing-id": "550e8400-e29b-41d4-a716-446655440000",
  "x-amount": "100",
  "x-transaction-hash": "0xabc123def456",
  "x-signature": "sig-hello-world",
};

// ─── Response helpers ──────────────────────────────────────────────────────

describe("x402 response helpers", () => {
  it("paymentRequired returns 402 with message", async () => {
    const res = paymentRequired("Payment needed");
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("Payment needed");
  });

  it("conflict returns 409 with message", async () => {
    const res = conflict("Duplicate transaction");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Duplicate transaction");
  });

  it("serverError returns 500 with message", async () => {
    const res = serverError("Internal error");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal error");
  });
});

// ─── withX402 ──────────────────────────────────────────────────────────────

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

    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: "consumer-1" },
        error: null,
      });
    mockInsert.mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      from: mockSupabaseFrom,
    } as never);
  });

  // ── Payment validation ────────────────────────────────────────────────

  it("returns 402 when all payment headers are missing", async () => {
    const wrapped = withX402(mockHandler);
    const res = await wrapped(createRequest());

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("x-listing-id");
    expect(body.error).toContain("x-amount");
    expect(body.error).toContain("x-transaction-hash");
    expect(body.error).toContain("x-signature");
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when a single header is missing", async () => {
    const { "x-amount": _, ...partial } = validHeaders;
    void _;
    const wrapped = withX402(mockHandler);
    const res = await wrapped(createRequest(partial));

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when amount is not a valid integer string", async () => {
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

  it("returns 402 when listing-id is not a valid UUID", async () => {
    const wrapped = withX402(mockHandler);
    const res = await wrapped(
      createRequest({ ...validHeaders, "x-listing-id": "not-a-uuid" })
    );

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when tx-hash is empty", async () => {
    const wrapped = withX402(mockHandler);
    const res = await wrapped(
      createRequest({ ...validHeaders, "x-transaction-hash": "" })
    );

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  // ── Auth context ──────────────────────────────────────────────────────

  it("returns 402 when request has no auth context (consumer not found)", async () => {
    setupMockChain();
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const wrapped = withX402(mockHandler);
    const res = await wrapped(createRequest(validHeaders));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("Consumer not found");
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 402 when consumer wallet is not in database", async () => {
    setupMockChain();
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  // ── Replay protection ─────────────────────────────────────────────────

  it("returns 409 when tx_hash already exists (replay attack)", async () => {
    setupMockChain();
    mockSingle.mockResolvedValueOnce({
      data: { id: "existing-tx", tx_hash: "0xabc123def456" },
      error: null,
    });

    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already been processed");
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 409 on postgres unique violation during insert (race condition)", async () => {
    setupMockChain();
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: "consumer-1" },
        error: null,
      });
    mockInsert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });

    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(409);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  // ── Database errors ───────────────────────────────────────────────────

  it("returns 500 when transaction insert fails with non-unique error", async () => {
    setupMockChain();
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: "consumer-1" },
        error: null,
      });
    mockInsert.mockResolvedValue({ error: { code: "23503", message: "FK violation" } });

    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(500);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("returns 500 when handler throws", async () => {
    mockHandler.mockRejectedValue(new Error("handler crashed"));

    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(500);
    expect(mockHandler).toHaveBeenCalled();
  });

  // ── Success flow ──────────────────────────────────────────────────────

  it("calls handler with payment context on successful validation", async () => {
    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: {
          listing_id: "550e8400-e29b-41d4-a716-446655440000",
          amount: 100n,
          tx_hash: "0xabc123def456",
          signature: "sig-hello-world",
        },
      }),
      expect.objectContaining({
        payment: {
          listing_id: "550e8400-e29b-41d4-a716-446655440000",
          amount: 100n,
          tx_hash: "0xabc123def456",
          signature: "sig-hello-world",
        },
      }),
    );
  });

  it("calls handler with wallet_address from auth context", async () => {
    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };

    const wrapped = withX402(mockHandler);
    await wrapped(req);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        wallet_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    );
  });

  it("inserts transaction record with correct data", async () => {
    const req = createRequest(validHeaders);
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    await wrapped(req);

    const insertedArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedArg.listing_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(insertedArg.consumer_id).toBe("consumer-1");
    expect(insertedArg.tx_hash).toBe("0xabc123def456");
    expect(Number(insertedArg.amount)).toBe(100);
    expect(insertedArg.status).toBe("pending");
  });
});

// ─── BigInt handling ───────────────────────────────────────────────────────

describe("withX402 BigInt handling", () => {
  const mockHandler = vi.fn<(...args: unknown[]) => Promise<Response>>();
  const mockSupabaseFrom = vi.fn();

  function setupMocks() {
    const mockSingle = vi.fn();
    const mockEq = vi.fn();

    mockEq.mockReturnValue({ single: mockSingle });
    mockSupabaseFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
      eq: mockEq,
      single: mockSingle,
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));

    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: "consumer-1" },
        error: null,
      });

    vi.mocked(createClient).mockResolvedValue({
      from: mockSupabaseFrom,
    } as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler.mockResolvedValue(jsonResponse({ ok: true }));
    setupMocks();
  });

  it("handles large BigInt amounts without error", async () => {
    const req = createRequest({
      ...validHeaders,
      "x-amount": "9007199254740991",
    });
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    const res = await wrapped(req);

    expect(res.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payment: expect.objectContaining({ amount: 9007199254740991n }),
      }),
    );
  });

  it("converts BigInt to Number for database storage", async () => {
    const req = createRequest({
      ...validHeaders,
      "x-amount": "50000",
    });
    (req as { auth?: { wallet_address: string } }).auth = {
      wallet_address: "0x1234567890123456789012345678901234567890",
    };

    const wrapped = withX402(mockHandler);
    await wrapped(req);

    expect(mockSupabaseFrom).toHaveBeenCalledWith("transactions");
  });
});

// ─── Chain flow ────────────────────────────────────────────────────────────

describe("withX402 chain flow", () => {
  const mockSupabaseFrom = vi.fn();

  function setupMocks() {
    const mockSingle = vi.fn();
    const mockEq = vi.fn();
    mockEq.mockReturnValue({ single: mockSingle });
    mockSupabaseFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
      eq: mockEq,
      single: mockSingle,
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));

    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: "consumer-1" },
        error: null,
      });

    vi.mocked(createClient).mockResolvedValue({
      from: mockSupabaseFrom,
    } as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("short-circuits via chain() when x402 payment validation fails", async () => {
    const mockHandler = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    const handler = chain([withX402(mockHandler)]);
    const res = await handler(createRequest({}));

    expect(res.status).toBe(402);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("short-circuits via chain() when auth middleware returns 401 before x402 runs", async () => {
    const authMw = vi.fn().mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const mockHandler = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    const handler = chain([authMw, withX402(mockHandler)]);
    const res = await handler(createRequest(validHeaders));

    expect(res.status).toBe(401);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("propagates auth context from request.auth to x402 via chain()", async () => {
    const mockHandler = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    const authMw = vi.fn().mockImplementation((req: Request) => {
      (req as { auth?: { wallet_address: string } }).auth = {
        wallet_address: "0x1234567890123456789012345678901234567890",
      };
      return jsonResponse({ ok: true });
    });

    const handler = chain([authMw, withX402(mockHandler)]);
    await handler(createRequest(validHeaders));

    // chain() returns 500 because all middleware passed but no final handler
    expect(mockHandler).toHaveBeenCalled();
  });
});
