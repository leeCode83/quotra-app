"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { depositToEscrow } from "@/lib/web3/contracts";
import { v4 as uuidv4 } from "uuid";

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

async function mockX402FacilitatorVerify(
  txHash: `0x${string}`,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _amount: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _consumerAddress: `0x${string}`,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _listingId: string
): Promise<{ verified: boolean; receipt?: { blockNumber: number; gasUsed: string } }> {
  // Simulate network delay for facilitator verification
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Mock verification - in production this would call the x402 facilitator
  const isValid = txHash.startsWith("0x") && txHash.length === 66;

  if (!isValid) {
    return { verified: false };
  }

  return {
    verified: true,
    receipt: {
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      gasUsed: "21000",
    },
  };
}

export function useX402Payment(): UseX402PaymentReturn {
  const { address, isConnected } = useAccount();

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

        // Step 1: Call escrow deposit
        await depositToEscrow(address, amountBigInt);

        // Step 2: Generate unique tx hash (in production this comes from the blockchain)
        const uniqueTxHash = `0x${uuidv4().replace(/-/g, "")}${uuidv4().replace(/-/g, "").slice(0, 30)}` as `0x${string}`;
        setTxHash(uniqueTxHash);

        // Step 3: Move to confirming state
        setStatus("confirming");

        // Step 4: Verify via x402 facilitator mock
        const verification = await mockX402FacilitatorVerify(
          uniqueTxHash,
          paymentAmount,
          address,
          targetListingId
        );

        if (!verification.verified) {
          throw new Error("x402 facilitator verification failed");
        }

        // Step 5: Record transaction in backend
        const token = localStorage.getItem("quotra_jwt");
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            listing_id: targetListingId,
            tx_hash: uniqueTxHash,
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
    [address, isConnected]
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
