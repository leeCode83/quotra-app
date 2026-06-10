import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../../app/api/playground/chat/route";
import { GET } from "../../../app/api/playground/usage/route";
import { NextRequest } from "next/server";

const mockSupabaseSingle = vi.fn();
const mockSupabaseInsert = vi.fn();

const mockSupabaseEqObj = {
  eq: vi.fn(),
  single: mockSupabaseSingle,
};
mockSupabaseEqObj.eq.mockReturnValue(mockSupabaseEqObj);

const mockSupabaseSelect = vi.fn(() => mockSupabaseEqObj);

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
      update: vi.fn(() => mockSupabaseEqObj),
      insert: mockSupabaseInsert,
    })),
  })),
}));

vi.mock("@/lib/gateway/helpers", () => ({
  getActiveListing: vi.fn(() => ({
    id: "listing-123",
    max_input_chars: 1000,
    max_completion_tokens: 100,
    encrypted_key: "enc",
    key_iv: "iv",
    key_auth_tag: "tag",
    model_name: "gpt-mock",
  })),
  validateRequestLimits: vi.fn(),
  reserveQuotaSlot: vi.fn(),
  rollbackQuotaSlot: vi.fn(),
  GatewayError: class extends Error {
    status = 400;
    code = "ERR";
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn(() => "decrypted-key"),
}));

vi.mock("@/lib/ai-providers", () => ({
  callAIProvider: vi.fn(() => ({ text: "AI Response", usage: {} })),
  AIProviderError: class extends Error {
    status = 500;
    code = "AI_ERR";
  },
}));

describe("Playground Usage Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return remaining calls correctly", async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: { calls_count: 1 },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/playground/usage?listingId=123&walletAddress=0xABC");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.callsCount).toBe(1);
    expect(json.remaining).toBe(2);
    expect(json.hasTrialRemaining).toBe(true);
  });
});

describe("Playground Chat Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseInsert.mockResolvedValue({ error: null });
  });

  it("should block request if free trial limit reached", async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: { calls_count: 3 },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/playground/chat?listingId=123", {
      method: "POST",
      headers: { "x-wallet-address": "0xABC" },
      body: JSON.stringify({ chat: "Hello" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("should process request and increment count if within limit", async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: { calls_count: 0 },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/playground/chat?listingId=123", {
      method: "POST",
      headers: { "x-wallet-address": "0xABC" },
      body: JSON.stringify({ chat: "Hello" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.text).toBe("AI Response");
  });
});
