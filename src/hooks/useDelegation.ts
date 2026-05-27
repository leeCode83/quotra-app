"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { signJWT } from "@/lib/jwt";

export type DelegationStatus =
  | "idle"
  | "signing"
  | "storing"
  | "success"
  | "error";

export interface DelegationData {
  /** Delegator (provider) address */
  delegator: `0x${string}`;
  /** Delegate (authorized account) address - same as delegator for self-delegation */
  delegate: `0x${string}`;
  /** Authority chain per ERC-7710 */
  authority: string;
  /** Caveats defining scope of delegation */
  caveats: Array<{
    enforcer: `0x${string}`;
    terms: string;
  }>;
  /** Salt for uniqueness */
  salt: string;
  /** Signature from delegator */
  signature: `0x${string}`;
  /** Timestamp when delegation was created */
  timestamp: number;
}

export interface UseDelegationReturn {
  signDelegation: (providerName: string) => Promise<void>;
  delegationStatus: DelegationStatus;
  delegationData: DelegationData | null;
  isSigning: boolean;
  error: string | null;
  reset: () => void;
}

function createDelegationMessage(data: Omit<DelegationData, "signature">): string {
  return JSON.stringify(
    {
      types: {
        Delegation: [
          { name: "delegator", type: "address" },
          { name: "delegate", type: "address" },
          { name: "authority", type: "string" },
          { name: "salt", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      primaryType: "Delegation",
      message: {
        delegator: data.delegator,
        delegate: data.delegate,
        authority: data.authority,
        salt: data.salt,
        timestamp: data.timestamp,
      },
    },
    null,
    2
  );
}

export function useDelegation(): UseDelegationReturn {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [delegationStatus, setDelegationStatus] = useState<DelegationStatus>("idle");
  const [delegationData, setDelegationData] = useState<DelegationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signDelegation = useCallback(
    async (providerName: string) => {
      if (!isConnected || !address) {
        setError("Wallet not connected");
        setDelegationStatus("error");
        return;
      }

      setError(null);
      setDelegationStatus("signing");

      try {
        const timestamp = Date.now();
        const salt = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}` as `0x${string}`;

        const delegationPayload: Omit<DelegationData, "signature"> = {
          delegator: address,
          delegate: address,
          authority: "erc7710.quotra.eth",
          caveats: [
            {
              enforcer: "0x0000000000000000000000000000000000000000" as `0x${string}`,
              terms: JSON.stringify({
                scope: "provider",
                providerName,
                permissions: ["register_listing", "update_listing", "revoke_listing"],
              }),
            },
          ],
          salt,
          timestamp,
        };

        const message = createDelegationMessage(delegationPayload);
        const signature = await signMessageAsync({ message });

        const fullDelegation: DelegationData = {
          ...delegationPayload,
          signature,
        };

        setDelegationStatus("storing");

        const token = await signJWT({
          wallet_address: address,
          delegation_type: "erc7710",
        });

        const response = await fetch("/api/providers/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            wallet_address: address,
            name: providerName,
            encrypted_api_key: "mock_encrypted_key_for_provider",
            delegation_json: fullDelegation as unknown as Record<string, unknown>,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to store delegation");
        }

        setDelegationData(fullDelegation);
        setDelegationStatus("success");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delegation failed";
        setError(message);
        setDelegationStatus("error");
      }
    },
    [address, isConnected, signMessageAsync]
  );

  const reset = useCallback(() => {
    setDelegationStatus("idle");
    setDelegationData(null);
    setError(null);
  }, []);

  return {
    signDelegation,
    delegationStatus,
    delegationData,
    isSigning: delegationStatus === "signing",
    error,
    reset,
  };
}
