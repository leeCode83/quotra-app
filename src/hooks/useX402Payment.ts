"use client";

import { useCallback, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { escrowAbi, ESCROW_ADDRESS } from "@/lib/web3/contracts";

export type PaymentStatus =
  | "idle"
  | "processing"
  | "confirming"
  | "confirmed"
  | "failed";

export interface PaymentState {
  status: PaymentStatus;
  txHash: `0x${string}` | null;
  amount: string | null;
  listingId: string | null;
  error: string | null;
  isProcessing: boolean;
}

export interface X402VerificationResult {
  verified: boolean;
  receipt?: {
    blockNumber: number;
    gasUsed: string;
  };
  error?: string;
}

export interface UseX402PaymentReturn {
  initiatePayment: (amount: string, listingId: string) => Promise<void>;
  paymentStatus: PaymentStatus;
  txHash: `0x${string}` | null;
  amount: string | null;
  listingId: string | null;
  isProcessing: boolean;
  error: string | null;
  reset: () => void;
}

const FACILITATOR_URL =
  process.env.NEXT_PUBLIC_X402_FACILITATOR_URL ||
  "https://x402.facilitator.coinbase.com";

async function verifyWithFacilitator(
  txHash: `0x${string}`,
  amount: string,
  consumerAddress: `0x${string}`,
  listingId: string
): Promise<X402VerificationResult> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_hash: txHash,
        amount,
        consumer_address: consumerAddress,
        listing_id: listingId,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        verified: false,
        error: body.message ?? `Facilitator returned ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      verified: true,
      receipt: {
        blockNumber: data.block_number,
        gasUsed: data.gas_used,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Facilitator request failed";
    return { verified: false, error: message };
  }
}

export function useX402Payment(): UseX402PaymentReturn {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = useCallback(
    async (paymentAmount: string, targetListingId: string) => {
      if (!isConnected || !address) {
        setError("Wallet not connected");
        setStatus("failed");
        return;
      }

      setError(null);
      setStatus("processing");
      setAmount(paymentAmount);
      setListingId(targetListingId);

      try {
        const [whole, fraction = ""] = paymentAmount.split(".");
        const paddedFraction = fraction.padEnd(18, "0").slice(0, 18);
        const amountBigInt = BigInt(`${whole}${paddedFraction}`);

        // Step 1: Send escrow deposit transaction via wagmi
        const hash = await writeContractAsync({
          address: ESCROW_ADDRESS,
          abi: escrowAbi,
          functionName: "deposit",
          args: [address, amountBigInt],
          value: amountBigInt,
        });

        setTxHash(hash);

        // Step 2: Move to confirming state
        setStatus("confirming");

        // Step 3: Verify via x402 facilitator
        const verification = await verifyWithFacilitator(
          hash,
          paymentAmount,
          address,
          targetListingId
        );

        if (!verification.verified) {
          throw new Error(verification.error ?? "x402 facilitator verification failed");
        }

        // Step 4: Record transaction in backend
        const token = localStorage.getItem("quotra_jwt");
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            listing_id: targetListingId,
            tx_hash: hash,
            amount: String(amountBigInt),
          }),
        });

        if (!response.ok && response.status !== 404) {
          console.warn("[useX402Payment] Transaction API returned:", response.status);
        }

        setStatus("confirmed");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Payment failed";
        setError(message);
        setStatus("failed");
      }
    },
    [address, isConnected, writeContractAsync]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setAmount(null);
    setListingId(null);
    setError(null);
  }, []);

  return {
    initiatePayment,
    paymentStatus: status,
    txHash,
    amount,
    listingId,
    isProcessing: status === "processing" || status === "confirming",
    error,
    reset,
  };
}
