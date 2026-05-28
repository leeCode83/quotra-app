"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";

export type PaymentStatus =
  | "idle"
  | "processing"
  | "confirming"
  | "confirmed"
  | "failed";

export interface PaymentState {
  status: PaymentStatus;
  txHash: string | null;
  amount: string | null;
  listingId: string | null;
  error: string | null;
  isProcessing: boolean;
}

export interface UseX402PaymentReturn {
  initiatePayment: (amount: string, listingId: string) => Promise<void>;
  paymentStatus: PaymentStatus;
  txHash: string | null;
  amount: string | null;
  listingId: string | null;
  isProcessing: boolean;
  error: string | null;
  reset: () => void;
}

export function useX402Payment(): UseX402PaymentReturn {
  const { address, isConnected } = useAccount();

  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
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
        const paddedFraction = fraction.padEnd(6, "0").slice(0, 6);
        const amountBigInt = BigInt(`${whole}${paddedFraction}`);
        const amountStr = amountBigInt.toString();

        setStatus("confirming");

        const token = localStorage.getItem("quotra_jwt");
        const response = await fetch("/api/gateway/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "x-listing-id": targetListingId,
            "x-amount": amountStr,
            "x-delegation-id": targetListingId,
          },
          body: JSON.stringify({
            model: "default",
            messages: [{ role: "user", content: "payment verification" }],
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? `Gateway returned ${response.status}`);
        }

        const txHashHeader = response.headers.get("x-transaction-hash");
        setTxHash(txHashHeader);

        const tokenResponse = localStorage.getItem("quotra_jwt");
        if (tokenResponse) {
          const recordResponse = await fetch("/api/transactions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenResponse}`,
            },
            body: JSON.stringify({
              listing_id: targetListingId,
              tx_hash: txHashHeader || "pending",
              amount: amountStr,
            }),
          });

          if (!recordResponse.ok && recordResponse.status !== 404) {
            console.warn("[useX402Payment] Transaction API returned:", recordResponse.status);
          }
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
