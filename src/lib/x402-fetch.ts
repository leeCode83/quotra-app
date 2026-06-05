/**
 * Client-side x402 payment fetch helper for Quotra.
 *
 * Handles the 402 -> pay -> retry flow:
 *   1. Makes the first request with no X-PAYMENT header
 *   2. If server returns 402, extracts payment requirements from headers
 *   3. Uses the connected wallet to send USDC payment via the facilitator
 *   4. Retries the request with the X-PAYMENT header containing payment proof
 *
 * This replaces all JWT/Bearer auth patterns in the consumer flow.
 * Payment proof IS authentication.
 */

"use client";

export interface X402PaymentRequired {
  amount: string;
  token?: string;
  payTo: string;
  network: string;
  acceptHeader?: string;
  resource?: string;
}

export interface X402FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
}

export interface X402FetchResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  paid: boolean;
}

export async function x402Fetch<T = unknown>(
  url: string,
  options: X402FetchOptions = {},
  onPaymentRequired?: () => Promise<Record<string, string>>,
): Promise<X402FetchResult<T>> {
  const { method = "POST", headers = {}, body } = options;

  // First attempt: no X-PAYMENT header
  const firstRes = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

  // If not 402, return the result directly
  if (firstRes.status !== 402) {
    const firstData = firstRes.ok
      ? await firstRes.json().catch(() => ({}))
      : await firstRes.json().catch(() => ({ error: "HTTP " + firstRes.status }));
    return {
      ok: firstRes.ok,
      status: firstRes.status,
      data: firstData as T,
      paid: false,
    };
  }

  // Extract payment requirements from 402 response
  const acceptHeader = firstRes.headers.get("x-402-accept") || firstRes.headers.get("x-payment-accept") || "";
  const resource = firstRes.headers.get("x-402-resource") || firstRes.headers.get("x-resource") || "";
  const payTo = firstRes.headers.get("x-402-pay-to") || process.env.NEXT_PUBLIC_PAY_TO_ADDRESS || "";
  const network = firstRes.headers.get("x-402-network") || "eip155:84532";

  let amount = "0";
  let token = "";
  if (acceptHeader) {
    try {
      const parsed = JSON.parse(acceptHeader);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        amount = first.value || first.amount || "0";
        token = first.token || "";
      } else if (parsed.value || parsed.amount) {
        amount = parsed.value || parsed.amount || "0";
        token = parsed.token || "";
      }
    } catch {
      amount = acceptHeader;
    }
  }

  const paymentRequired: X402PaymentRequired = { amount, token, payTo, network, acceptHeader, resource };

  if (!onPaymentRequired) {
    const body402 = await firstRes.json().catch(() => ({ error: "Payment required" }));
    return {
      ok: false,
      status: 402,
      data: { ...body402, paymentRequired } as T,
      paid: false,
    };
  }

  // Payment handler provided: wait for payment proof and retry
  const paymentHeaders = await onPaymentRequired();

  const secondRes = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers, ...paymentHeaders },
    body,
  });

  const secondData = secondRes.ok
    ? await secondRes.json().catch(() => ({}))
    : await secondRes.json().catch(() => ({ error: "HTTP " + secondRes.status }));

  return {
    ok: secondRes.ok,
    status: secondRes.status,
    data: secondData as T,
    paid: true,
  };
}
