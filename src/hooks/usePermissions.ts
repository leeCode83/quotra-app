"use client";

import { useCallback, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { custom, createWalletClient, type EIP1193Provider } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import type { RequestExecutionPermissionsReturnType } from "@metamask/smart-accounts-kit/actions";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function usePermissions() {
  const { address, isConnected } = useAccount();

  const [grantedPermissions, setGrantedPermissions] = useState<RequestExecutionPermissionsReturnType | null>(null);
  const [sessionAccount, setSessionAccount] = useState<ReturnType<typeof privateKeyToAccount> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Generate or load ephemeral session account
    let pk = localStorage.getItem("quotra_session_pk") as `0x${string}` | null;
    if (!pk) {
      pk = generatePrivateKey();
      localStorage.setItem("quotra_session_pk", pk);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionAccount(privateKeyToAccount(pk));
  }, []);

  /**
   * Hapus ephemeral session key dari localStorage.
   * Panggil saat consumer merevoke semua permissions agar
   * session account lama tidak bisa digunakan kembali.
   */
  const clearSessionKey = useCallback(() => {
    localStorage.removeItem("quotra_session_pk");
    setSessionAccount(null);
    setGrantedPermissions(null);
  }, []);

  const requestPermission = useCallback(async (): Promise<{
    permissions?: RequestExecutionPermissionsReturnType;
    sessionAccount?: ReturnType<typeof privateKeyToAccount> | null;
    error?: string;
  }> => {
    if (!isConnected || !address) {
      const msg = "Wallet not connected";
      setError(msg);
      return { error: msg };
    }

    if (!window.ethereum) {
      const msg = "MetaMask not found";
      setError(msg);
      return { error: msg };
    }

    if (!sessionAccount) {
      const msg = "Session account not initialized";
      setError(msg);
      return { error: msg };
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createWalletClient({
        transport: custom(window.ethereum as unknown as EIP1193Provider),
      }).extend(erc7715ProviderActions());

      // 1. Check supported permission types for this chain
      const supported: Record<string, { chainIds: number[]; ruleTypes: string[] }> =
        await client.getSupportedExecutionPermissions();
      const nativeAllowanceInfo = supported["native-token-allowance"];
      const supportsNativeAllowance = nativeAllowanceInfo?.chainIds.includes(baseSepolia.id);

      if (!supportsNativeAllowance) {
        const msg = "native-token-allowance not supported on this chain. Supported types: " +
          Object.keys(supported).join(", ");
        setError(msg);
        return { error: msg };
      }

      // 2. Request permission
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 60 * 60 * 24 * 7; // 7 days

      const permissions = await client.requestExecutionPermissions([{
        chainId: baseSepolia.id,
        expiry,
        to: sessionAccount.address,
        from: address as `0x${string}`,
        permission: {
          type: 'native-token-allowance',
          data: {
            allowanceAmount: 1n,
            startTime: now,
            justification: 'Quotra session authentication — no spending',
          },
          isAdjustmentAllowed: true,
        },
      }]);

      if (!permissions || permissions.length === 0) {
        const msg = "User rejected the permission request. Please approve the MetaMask popup to continue.";
        setError(msg);
        return { error: msg };
      }

      setGrantedPermissions(permissions);

      return { permissions, sessionAccount };
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Failed to request permissions";
      let userMsg: string;
      if (raw.includes("User rejected") || raw.includes("user rejected") || raw.includes("rejected")) {
        userMsg = "Request rejected in MetaMask. Please approve the permission request.";
      } else if (raw.includes("not supported") || raw.includes("unsupported")) {
        userMsg = "Permission type not supported by your wallet. Check console for details.";
      } else {
        userMsg = raw;
      }
      setError(userMsg);
      console.error("[usePermissions] requestPermission error:", err);
      return { error: userMsg };
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, sessionAccount]);

  const getPermissionContext = useCallback(() => {
    if (!grantedPermissions || grantedPermissions.length === 0) return null;
    return grantedPermissions[0];
  }, [grantedPermissions]);

  return {
    grantedPermissions,
    sessionAccount,
    isLoading,
    error,
    requestPermission,
    getPermissionContext,
    setGrantedPermissions,
    clearSessionKey,
  };
}
