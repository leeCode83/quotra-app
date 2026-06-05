/**
 * @deprecated Use `x402Fetch` from `@/lib/x402-fetch` directly instead.
 *
 * This hook is kept for backwards compatibility but delegates to the
 * new x402-fetch utility. It wraps x402Fetch with React state management
 * for loading/error/payment tracking in component context.
 */

"use client";

import { useState, useCallback } from "react";
import { x402Fetch, type X402PaymentRequired, type X402FetchResult } from "@/lib/x402-fetch";

interface UseX402PaymentState {
  isLoading: boolean;
  isPaymentRequired: boolean;
  isPaid: boolean;
  error: string | null;
  paymentRequired: X402PaymentRequired | null;
}

interface UseX402PaymentReturn extends UseX402PaymentState {
  callEndpoint: (url: string, body?: Record<string, unknown>) => Promise<X402FetchResult | null>;
  payAndRetry: () => Promise<void>;
  resetPayment: () => void;
}

export function useX402Payment(): UseX402PaymentReturn {
  const [state, setState] = useState<UseX402PaymentState>({
    isLoading: false,
    isPaymentRequired: false,
    isPaid: false,
    error: null,
    paymentRequired: null,
  });

  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingBody, setPendingBody] = useState<Record<string, unknown> | null>(null);

  const callEndpoint = useCallback(async (
    url: string,
    body?: Record<string, unknown>
  ): Promise<X402FetchResult | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    setPendingUrl(url);
    setPendingBody(body || null);

    try {
      const result = await x402Fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (result.status === 402 && !result.ok) {
        const paymentRequired = (result.data as { paymentRequired?: X402PaymentRequired }).paymentRequired || null;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isPaymentRequired: true,
          paymentRequired,
        }));
        return result;
      }

      if (result.ok) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isPaid: result.paid,
          isPaymentRequired: false,
        }));
        return result;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: (result.data as { error?: string })?.error || "Request failed with status " + result.status,
      }));
      return result;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred",
      }));
      return null;
    }
  }, []);

  const payAndRetry = useCallback(async () => {
    if (!pendingUrl) return;

    setState((prev) => ({ ...prev, isLoading: true, isPaymentRequired: false }));

    try {
      // For MVP: generate demo payment proof
      // In production: use x402/evm client to create real payment payload
      const paymentProof = "demo_payment_" + Date.now();

      const result = await x402Fetch(pendingUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": paymentProof,
        },
        body: pendingBody ? JSON.stringify(pendingBody) : undefined,
      });

      if (result.ok) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isPaid: true,
          isPaymentRequired: false,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: (result.data as { error?: string })?.error || "Request failed after payment",
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Payment failed",
      }));
    }
  }, [pendingUrl, pendingBody]);

  const resetPayment = useCallback(() => {
    setState({
      isLoading: false,
      isPaymentRequired: false,
      isPaid: false,
      error: null,
      paymentRequired: null,
    });
    setPendingUrl(null);
    setPendingBody(null);
  }, []);

  return { ...state, callEndpoint, payAndRetry, resetPayment };
}
