"use client";

import { useCallback, useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";

export interface UseDelegationReturn {
  createProviderDelegation: (targetAddress: string) => Promise<{ delegationId: string; permissionsContext: Record<string, unknown>; delegationManager: string; error?: never } | { error: string } | undefined>;
  permissionsContext: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
}

export function useDelegation(): UseDelegationReturn {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [permissionsContext, setPermissionsContext] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProviderDelegation = useCallback(
    async (targetAddress: string) => {
      if (!isConnected) {
        setError("Wallet not connected (isConnected is false)");
        return { error: "Wallet not connected (isConnected is false)" };
      }
      if (!address) {
        setError("Wallet not connected (address is missing)");
        return { error: "Wallet not connected (address is missing)" };
      }

      const wagmiChainId = await publicClient?.getChainId();
      if (wagmiChainId !== baseSepolia.id) {
        setError("Please switch your wallet to Base Sepolia network first.");
        return { error: "Please switch your wallet to Base Sepolia network first." };
      }

      let currentWalletClient = walletClient;
      if (!currentWalletClient) {
        if (typeof window !== "undefined" && window.ethereum) {
          // Fallback if wagmi hasn't provided it yet
          const { createWalletClient, custom } = await import("viem");
          currentWalletClient = createWalletClient({
            account: address as Hex,
            chain: baseSepolia,
            transport: custom(window.ethereum),
          }) as typeof walletClient;
        } else {
          setError("Wallet not connected (walletClient is missing and window.ethereum not found)");
          return { error: "Wallet not connected (walletClient is missing and window.ethereum not found)" };
        }
      }

      if (!publicClient) {
        setError("Wallet not connected (publicClient is missing)");
        return { error: "Wallet not connected (publicClient is missing)" };
      }

      setIsLoading(true);
      setError(null);

      try {


        // Request EIP-7715 Execution Permissions
        const clientWithPermissions = currentWalletClient!.extend(erc7715ProviderActions());
        const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Hex;

        const expiry = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days max

        const grantedPermissions = await clientWithPermissions.requestExecutionPermissions([
          {
            chainId: wagmiChainId,
            to: targetAddress as Hex,
            permission: {
              type: "erc20-token-periodic",
              isAdjustmentAllowed: true,
              data: {
                tokenAddress: USDC_ADDRESS,
                periodAmount: 1000000n,
                periodDuration: 86400,
                justification: "Pay 1Shot Relayer fees",
              },
            },
            expiry,
          },
        ]);

        if (!grantedPermissions || grantedPermissions.length === 0) {
          throw new Error("No permissions granted from wallet.");
        }

        const permissionsContextValue = grantedPermissions[0]?.context;
        if (!permissionsContextValue) {
          throw new Error("No permissions context returned from wallet.");
        }
        
        // Extract delegationManager from permission response if available, fallback to stateless deleGator
        const delegationManager = grantedPermissions[0]?.delegationManager ?? "0x8213F90BA183Edbd031D1c6C088b9F0d5656dc02";

        const result = {
          delegationId: permissionsContextValue,
          permissionsContext: grantedPermissions[0] as unknown as Record<string, unknown>,
          delegationManager: delegationManager as string,
        };

        setPermissionsContext(result.permissionsContext);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delegation request failed";
        setError(message);
        return { error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [address, isConnected, walletClient, publicClient]
  );

  return {
    createProviderDelegation,
    permissionsContext,
    isLoading,
    error,
  };
}
