import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../../app/api/permissions/[listingId]/route';

const { mockSupabase } = vi.hoisted(() => {
  return {
    mockSupabase: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('POST /api/permissions/[listingId] — check permission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if wallet_address is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/permissions/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ listingId: '123' }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing wallet_address');
  });

  it('returns hasPermission: true if active permission exists', async () => {
    const req = new NextRequest('http://localhost:3000/api/permissions/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: '0xABC' }),
    });

    const mockPermission = {
      id: 'perm1',
      erc7715_proof: '{"some":"context"}',
    };

    mockSupabase.single.mockResolvedValue({ data: mockPermission, error: null });

    const res = await POST(req, { params: Promise.resolve({ listingId: '123' }) });

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.hasPermission).toBe(true);
    expect(data.permissionContext).toEqual({ some: 'context' });
  });

  it('returns hasPermission: false if permission is expired or missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/permissions/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: '0xABC' }),
    });

    mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    const res = await POST(req, { params: Promise.resolve({ listingId: '123' }) });
    const data = await res.json();

    expect(data.hasPermission).toBe(false);
  });

  it('returns hasPermission: false if consumer not found', async () => {
    const req = new NextRequest('http://localhost:3000/api/permissions/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: '0xABC' }),
    });

    mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    const res = await POST(req, { params: Promise.resolve({ listingId: '123' }) });
    const data = await res.json();

    expect(data.hasPermission).toBe(false);
  });
});
