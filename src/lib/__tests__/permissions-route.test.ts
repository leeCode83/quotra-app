import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../../app/api/permissions/route';

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  upsert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/route-client", () => ({
  createRouteClient: vi.fn(() => ({
    supabase: mockSupabase,
    walletAddress: "0xabc",
  })),
  unauthorized: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
}));

describe('Permissions API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/permissions — save permission', () => {
    it('returns 400 if validation fails', async () => {
      const req = new NextRequest('http://localhost:3000/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      const res = await POST(req);
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.error).toBe('Missing required fields');
    });

    it('creates consumer if missing, and inserts permission', async () => {
      const reqBody = {
        listing_id: '123',
        permission_context: { some: 'context' },
        session_account_address: '0xdef',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      const req = new NextRequest('http://localhost:3000/api/permissions', {
        method: 'POST',
        body: JSON.stringify(reqBody),
      });

      mockSupabase.single.mockResolvedValue({ data: { id: 'consumer-123' }, error: null });

      const res = await POST(req);
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify upsert and insert calls
      expect(mockSupabase.upsert).toHaveBeenCalledTimes(1);
      expect(mockSupabase.insert).toHaveBeenCalledTimes(1);
    });
  });
});
