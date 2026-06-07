import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../../app/api/permissions/route';

const { mockSupabase } = vi.hoisted(() => {
  return {
    mockSupabase: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    }
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('Permissions API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/permissions', () => {
    it('returns 400 if params are missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/permissions');
      const res = await GET(req);
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.error).toBe('Missing listing_id or wallet_address');
    });

    it('returns hasPermission: true if active permission exists', async () => {
      const req = new NextRequest('http://localhost:3000/api/permissions?listing_id=123&wallet_address=0xABC');
      
      const mockPermission = {
        id: 'perm1',
        erc7715_proof: '{"some":"context"}',
        consumer_address: '0xabc'
      };

      mockSupabase.single.mockResolvedValue({ data: mockPermission, error: null });

      const res = await GET(req);
      const data = await res.json();
      
      expect(data.hasPermission).toBe(true);
      expect(data.permissionContext).toEqual({ some: 'context' });
    });

    it('returns hasPermission: false if permission is expired or missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/permissions?listing_id=123&wallet_address=0xABC');
      
      mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const res = await GET(req);
      const data = await res.json();
      
      expect(data.hasPermission).toBe(false);
    });
  });

  describe('POST /api/permissions', () => {
    it('returns 400 if validation fails', async () => {
      const req = new NextRequest('http://localhost:3000/api/permissions', {
        method: 'POST',
        headers: { 'x-wallet-address': '0xabc' },
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
        headers: { 'x-wallet-address': '0xabc' },
        body: JSON.stringify(reqBody),
      });

      mockSupabase.upsert.mockResolvedValue({ data: null, error: null });

      const res = await POST(req);
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify upsert calls
      expect(mockSupabase.upsert).toHaveBeenCalledTimes(2); // One for consumer, one for permission
    });
  });
});
