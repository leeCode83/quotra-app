"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase-client";
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
  try {
    const response = await apiClient("/api/escrow/claim", {
      method: "GET",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error("Failed to fetch claim history");
    }

    const data = await response.json();
    return data.claims ?? [];
  } catch {
    return [];
  }
}

async function fetchTotalEarnings(walletAddress: string): Promise<number> {
  const supabase = createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .ilike("wallet_address", walletAddress)
    .maybeSingle();

  if (!provider) return 0;

  const { data: listings } = await supabase
    .from("listings")
    .select("id")
    .eq("provider_id", provider.id);

  if (!listings || listings.length === 0) return 0;

  const listingIds = listings.map((l) => l.id);
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount_usdc")
    .eq("status", "confirmed")
    .in("listing_id", listingIds);

  if (!transactions) return 0;

  const totalUsdc = transactions.reduce((sum, t) => sum + Number(t.amount_usdc), 0);
  return totalUsdc;
}

export function useProviderClaim(): UseProviderClaimReturn {
  const { address, isConnected } = useAccount();

  const { data: totalEarnings = 0 } = useQuery({
    queryKey: ["totalEarnings", address],
    queryFn: () => fetchTotalEarnings(address!),
    enabled: !!address,
  });

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
      const providerId = providerData.provider?.id;

      if (!providerId) {
        setClaimableAmount(0);
        setClaimStatus("idle");
        return;
      }

      // Fetch listings for this provider
      const listingsResponse = await fetch("/api/listings");
      const listingsData = await listingsResponse.json();
      const providerListings = (listingsData.listings ?? []).filter(
        (l: { provider_wallet: string | null }) =>
          l.provider_wallet?.toLowerCase() === address.toLowerCase()
      );
      const listingIds = providerListings.map((l: { id: string }) => l.id);

      if (listingIds.length > 0) {
        const history = await fetchClaimHistory();
        setClaimHistory(history);

        const totalClaimed = history
          .filter((c) => c.status === "claimed")
          .reduce((sum, c) => sum + c.amount_usdc, 0);

        const claimable = Math.max(0, Number(totalEarnings) * 0.9 - totalClaimed);
        setClaimableAmount(Number(claimable.toFixed(6)));
      } else {
        setClaimableAmount(0);
      }

      setClaimStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Calculation failed";
      setError(message);
      setClaimStatus("error");
    }
  }, [address, totalEarnings]);

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
