"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { ClaimHistory } from "@/types";
import { apiClient } from "@/lib/api-client";

export type ClaimStatus = "idle" | "calculating" | "claiming" | "success" | "error";

export interface UseProviderClaimReturn {
  claimableAmount: number;
  claim: () => Promise<void>;
  isClaiming: boolean;
  claimStatus: ClaimStatus;
  claimHistory: ClaimHistory[];
  error: string | null;
  refresh: () => Promise<void>;
}

async function fetchClaimHistory(): Promise<ClaimHistory[]> {
  const response = await apiClient("/api/escrow/claim", {
    method: "GET",
  });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch claim history (${response.status})`);
  }

  const data = await response.json();
  return data.claims ?? [];
}

export function useProviderClaim(): UseProviderClaimReturn {
  const { address, isConnected } = useAccount();

  const [claimableAmount, setClaimableAmount] = useState(0);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("idle");
  const [claimHistory, setClaimHistory] = useState<ClaimHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const calculateClaimable = useCallback(async () => {
    if (!address) return;

    setClaimStatus("calculating");
    try {
      const providerResponse = await apiClient("/api/providers", {
        method: "GET",
      });

      if (!providerResponse.ok) {
        if (providerResponse.status === 404) {
          setClaimableAmount(0);
          setClaimHistory([]);
          setClaimStatus("idle");
          return;
        }
        throw new Error("Failed to fetch provider data");
      }

      const providerData = await providerResponse.json();
      const provider = providerData.provider;

      if (!provider?.id) {
        setClaimableAmount(0);
        setClaimStatus("idle");
        return;
      }

      const history = await fetchClaimHistory();
      setClaimHistory(history);

      const pending = parseFloat(provider.pending_earnings_usdc || "0");
      setClaimableAmount(Number(pending.toFixed(6)));

      setClaimStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Calculation failed";
      setError(message);
      setClaimStatus("error");
    }
  }, [address]);

  const claim = useCallback(async () => {
    if (!isConnected || !address) {
      setError("Wallet not connected");
      setClaimStatus("error");
      return;
    }

    if (claimableAmount <= 0) {
      setError("No claimable amount available");
      setClaimStatus("error");
      return;
    }

    setError(null);
    setClaimStatus("claiming");

    try {
      const response = await apiClient("/api/escrow/claim", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Claim failed");
      }

      const result = await response.json();

      const newClaim: ClaimHistory = {
        id: "claim_" + Date.now(),
        provider_id: address,
        amount_usdc: result.claimable_amount ?? claimableAmount,
        tx_hash: result.tx_hash ?? null,
        status: "claimed",
        created_at: new Date().toISOString(),
      };

      setClaimHistory((prev) => [newClaim, ...prev]);
      setClaimableAmount(0);
      setClaimStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Claim failed";
      setError(message);
      setClaimStatus("error");
    }
  }, [address, isConnected, claimableAmount]);

  const refresh = useCallback(async () => {
    await calculateClaimable();
  }, [calculateClaimable]);

  useEffect(() => {
    if (isConnected && address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void calculateClaimable();
    }
  }, [isConnected, address, calculateClaimable]);

  return {
    claimableAmount,
    claim,
    isClaiming: claimStatus === "claiming",
    claimStatus,
    claimHistory,
    error,
    refresh,
  };
}
