"use client";

import { useCallback, useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { keccak256, encodeAbiParameters, toHex, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
  getSmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit";

const QUOTRA_SERVER_ACCOUNT = (process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Hex;

export interface UseDelegationReturn {
  createProviderDelegation: () => Promise<{ delegationId: Hex; signedDelegation: Hex; delegationJson: Record<string, unknown>; error?: never } | { error: string } | undefined>;
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
        const smartAccount = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          signer: { walletClient: currentWalletClient! },
          deploySalt: "0x0" as Hex,
          deployParams: [address as Hex, [], [], []],
        });

        const environment = getSmartAccountsEnvironment(84532);

        const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));

        const delegation = createDelegation({
          from: smartAccount.address,
          to: QUOTRA_SERVER_ACCOUNT,
          environment,
          // This is Provider delegation to allow server to spend USDC on behalf of provider.
          scope: {
            type: "erc20TransferAmount",
            tokenAddress: (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Hex,
            maxAmount: 100000000n, // 100 USDC (6 decimals)
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
        return { error: message };
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
