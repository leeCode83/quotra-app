"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase-client";
import { signJWT } from "@/lib/jwt";
import type { ClaimHistory } from "@/types";

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

async function fetchClaimHistory(walletAddress: string): Promise<ClaimHistory[]> {
  try {
    const token = await signJWT({ wallet_address: walletAddress });
    const response = await fetch("/api/escrow/claim", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
    .eq("wallet_address", walletAddress)
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
    .select("amount")
    .eq("status", "confirmed")
    .in("listing_id", listingIds);

  if (!transactions) return 0;

  const totalWei = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  return totalWei / 1e18;
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
      const token = await signJWT({ wallet_address: address });

      // Fetch provider info
      const providerResponse = await fetch("/api/providers/register", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

      // Fetch transactions for this provider's listings
      const listingsResponse = await fetch("/api/listings");
      const listingsData = await listingsResponse.json();
      const providerListings = (listingsData.listings ?? []).filter(
        (l: { provider_wallet: string | null }) =>
          l.provider_wallet?.toLowerCase() === address.toLowerCase()
      );
      const listingIds = providerListings.map((l: { id: string }) => l.id);

      if (listingIds.length > 0) {
        // In a real app, we'd fetch transactions from an API
        // For now, we use the claim endpoint's GET to get history and calculate
        const history = await fetchClaimHistory(address);
        setClaimHistory(history);

        // Calculate total claimed
        const totalClaimed = history
          .filter((c) => c.status === "claimed")
          .reduce((sum, c) => sum + c.amount_usdc, 0);

        // Real total earnings from confirmed transactions in Supabase
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
      const token = await signJWT({ wallet_address: address });

      const response = await fetch("/api/escrow/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Claim failed");
      }

      const result = await response.json();

      // Add new claim to history
      const newClaim: ClaimHistory = {
        id: `claim_${Date.now()}`,
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
