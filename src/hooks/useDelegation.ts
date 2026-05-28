"use client";

import { useCallback, useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits, keccak256, encodeAbiParameters, type Hex } from "viem";
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
  getSmartAccountsEnvironment,
  ScopeType,
} from "@metamask/smart-accounts-kit";

export interface UseDelegationReturn {
  createDelegation: (
    providerAddress: Hex,
    apiPrice: string
  ) => Promise<{ delegationId: Hex; signedDelegation: Hex } | undefined>;
  signedDelegation: Hex | null;
  isLoading: boolean;
  error: string | null;
}

export function useDelegation(): UseDelegationReturn {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [signedDelegation, setSignedDelegation] = useState<Hex | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDelegationFn = useCallback(
    async (providerAddress: Hex, apiPrice: string) => {
      if (!isConnected || !address || !walletClient || !publicClient) {
        setError("Wallet not connected");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const smartAccount = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          signer: { walletClient },
          deploySalt: "0x0" as Hex,
          deployParams: [address as Hex, [], [], []],
        });

        const environment = getSmartAccountsEnvironment(84532);

        const delegation = createDelegation({
          to: providerAddress,
          from: smartAccount.address,
          environment,
          scope: {
            type: ScopeType.Erc20TransferAmount,
            tokenAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS as Hex,
            maxAmount: parseUnits(apiPrice, 6),
          },
        });

        const signed = await smartAccount.signDelegation({ delegation });

        const delegationId = keccak256(
          encodeAbiParameters(
            [
              { type: "address" },
              { type: "address" },
              { type: "bytes32" },
              { type: "uint256" },
            ],
            [
              delegation.delegate,
              delegation.delegator,
              delegation.authority,
              BigInt(delegation.salt),
            ]
          )
        );

        const result = {
          delegationId,
          signedDelegation: signed,
        };

        setSignedDelegation(result.signedDelegation);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delegation failed";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [address, isConnected, walletClient, publicClient]
  );

  return {
    createDelegation: createDelegationFn,
    signedDelegation,
    isLoading,
    error,
  };
}
