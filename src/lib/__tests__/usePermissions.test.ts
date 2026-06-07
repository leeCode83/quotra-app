import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePermissions } from '@/hooks/usePermissions';
import * as wagmi from 'wagmi';

// Mock dependencies
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
}));

const { mockRequestExecutionPermissions } = vi.hoisted(() => {
  return {
    mockRequestExecutionPermissions: vi.fn().mockResolvedValue([
      { context: 'test-context', from: '0x123' }
    ])
  };
});

vi.mock('viem', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createWalletClient: vi.fn().mockReturnValue({
      extend: vi.fn().mockReturnValue({
        requestExecutionPermissions: mockRequestExecutionPermissions
      })
    }),
    custom: vi.fn(),
  };
});

vi.mock('@metamask/smart-accounts-kit/actions', () => ({
  erc7715ProviderActions: () => ({}),
}));

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear localStorage
    localStorage.clear();
    
    // reset window.ethereum
    Object.defineProperty(globalThis, 'window', {
      value: Object.create(window),
      writable: true,
    });
    Object.defineProperty(window, 'ethereum', {
      value: { isMetaMask: true },
      writable: true
    });
  });

  it('returns initial state correctly', () => {
    vi.mocked(wagmi.useAccount).mockReturnValue({
      address: '0x123',
      isConnected: true,
    } as unknown as ReturnType<typeof wagmi.useAccount>);
    
    const { result } = renderHook(() => usePermissions());

    expect(result.current.grantedPermissions).toBeNull();
    expect(result.current.sessionAccount).toBeDefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error if trying to request permission without being connected', async () => {
    vi.mocked(wagmi.useAccount).mockReturnValue({
      address: undefined,
      isConnected: false,
    } as unknown as ReturnType<typeof wagmi.useAccount>);

    const { result } = renderHook(() => usePermissions());

    await act(async () => {
      const res = await result.current.requestPermission();
      expect(res).toBeUndefined();
    });

    expect(result.current.error).toBe('Wallet not connected');
  });

  it('sets error if window.ethereum is not available', async () => {
    vi.mocked(wagmi.useAccount).mockReturnValue({
      address: '0x123',
      isConnected: true,
    } as unknown as ReturnType<typeof wagmi.useAccount>);
    
    Object.defineProperty(window, 'ethereum', {
      value: undefined,
      writable: true
    });

    const { result } = renderHook(() => usePermissions());

    await act(async () => {
      const res = await result.current.requestPermission();
      expect(res).toBeUndefined();
    });

    expect(result.current.error).toBe('MetaMask not found');
  });

  it('successfully requests execution permissions', async () => {
    vi.mocked(wagmi.useAccount).mockReturnValue({
      address: '0x123',
      isConnected: true,
    } as unknown as ReturnType<typeof wagmi.useAccount>);
    
    const { result } = renderHook(() => usePermissions());

    await act(async () => {
      const res = await result.current.requestPermission();
      expect(res).toBeDefined();
      expect(res!.permissions[0].context).toBe('test-context');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.grantedPermissions).toBeDefined();
    expect(result.current.grantedPermissions![0].context).toBe('test-context');
    
    expect(mockRequestExecutionPermissions).toHaveBeenCalled();
  });
});
