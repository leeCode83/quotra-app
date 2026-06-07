"use client";

import { useCallback, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseUnits, custom, createWalletClient, type EIP1193Provider } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import type { RequestExecutionPermissionsReturnType } from "@metamask/smart-accounts-kit/actions";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;

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

  const requestPermission = useCallback(async () => {
    if (!isConnected || !address) {
      setError("Wallet not connected");
      return;
    }

    if (!window.ethereum) {
      setError("MetaMask not found");
      return;
    }

    if (!sessionAccount) {
      setError("Session account not initialized");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createWalletClient({
        transport: custom(window.ethereum as unknown as EIP1193Provider),
      }).extend(erc7715ProviderActions());

      const currentTime = Math.floor(Date.now() / 1000);
      const expiry = currentTime + 60 * 60 * 24 * 7; // 7 days

      const permissions = await client.requestExecutionPermissions([{
        chainId: baseSepolia.id,
        expiry,
        to: sessionAccount.address,
        permission: {
          type: 'erc20-token-periodic',
          data: {
            tokenAddress: USDC_ADDRESS,
            periodAmount: parseUnits('10', 6), // 10 USDC per week
            periodDuration: 86400 * 7, // 1 week
            startTime: currentTime,
            justification: 'Permission for Quotra to pay AI API calls on your behalf',
          },
          isAdjustmentAllowed: true,
        },
      }]);

      setGrantedPermissions(permissions);

      return { permissions, sessionAccount };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to request permissions");
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
    setGrantedPermissions
  };
}
