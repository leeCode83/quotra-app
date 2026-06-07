"use client";

import { useCallback, useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { keccak256, encodeAbiParameters, toHex, type Hex } from "viem";
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
  getSmartAccountsEnvironment,
  ScopeType,
} from "@metamask/smart-accounts-kit";

const QUOTRA_SERVER_ACCOUNT = (process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Hex;

export interface UseDelegationReturn {
  createProviderDelegation: () => Promise<{ delegationId: Hex; signedDelegation: Hex; delegationJson: Record<string, unknown> } | undefined>;
  signedDelegation: Hex | null;
  delegationJson: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
}

export function useDelegation(): UseDelegationReturn {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [signedDelegation, setSignedDelegation] = useState<Hex | null>(null);
  const [delegationJson, setDelegationJson] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProviderDelegation = useCallback(
    async () => {
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

        const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));

        const delegation = createDelegation({
          from: smartAccount.address,
          to: QUOTRA_SERVER_ACCOUNT,
          environment,
          scope: {
            type: ScopeType.NativeTokenTransferAmount,
            maxAmount: 0n,
          },
          salt,
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

        const delegationJson: Record<string, unknown> = {
          delegation,
          signature: signed,
        };

        const result = {
          delegationId,
          signedDelegation: signed,
          delegationJson,
        };

        setSignedDelegation(result.signedDelegation);
        setDelegationJson(result.delegationJson);
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
    createProviderDelegation,
    signedDelegation,
    delegationJson,
    isLoading,
    error,
  };
}
