/**
 * x402 Payment middleware for Next.js API routes
 * Validates payment headers and records transactions
 */

import { x402PaymentSchema } from "@/lib/validators";
import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import type { AuthContext } from "./auth";

/**
 * x402 payment headers that must be present on payment-gated requests
 */
export interface X402Headers {
  "x-listing-id": string;
  "x-amount": string;
  "x-tx-hash": string;
  "x-signature": string;
}

/**
 * Payment context passed to handlers after successful payment validation
 */
export interface PaymentContext extends AuthContext {
  payment: {
    listing_id: string;
    amount: bigint;
    tx_hash: string;
    signature: string;
  };
}

/**
 * Extended request with payment context
 */
export interface PaymentRequest extends NextRequest {
  auth: AuthContext;
  payment: PaymentContext["payment"];
}

/**
 * Payment handler function signature
 */
export type PaymentHandler<T = PaymentContext> = (
  request: PaymentRequest,
  context: T
) => Promise<Response> | Response;

/**
 * Validates x402 payment headers and records the transaction
 *
 * Extracts payment headers (X-Transaction-Hash, X-Amount, X-Listing-Id, X-Signature),
 * validates them against x402PaymentSchema, checks for replay attacks using
 * Supabase transactions table, and atomically inserts new transaction records.
 *
 * @param handler - The actual API route handler
 * @returns Wrapped handler that enforces payment validation
 *
 * @example
 * ```typescript
 * // In your API route:
 * export const POST = withX402(async (request, context) => {
 *   const { listing_id, tx_hash, amount } = context.payment;
 *   // Process the paid request
 *   return Response.json({ success: true });
 * });
 * ```
 */
export function withX402<T = PaymentContext>(
  handler: PaymentHandler<T>
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    // Extract x402 payment headers
    const listingId = request.headers.get("x-listing-id");
    const amountStr = request.headers.get("x-amount");
    const txHash = request.headers.get("x-transaction-hash");
    const signature = request.headers.get("x-signature");

    // Check all required headers are present
    const missingHeaders: string[] = [];
    if (!listingId) missingHeaders.push("x-listing-id");
    if (!amountStr) missingHeaders.push("x-amount");
    if (!txHash) missingHeaders.push("x-transaction-hash");
    if (!signature) missingHeaders.push("x-signature");

    if (missingHeaders.length > 0) {
      return paymentRequired(
        `Missing required payment headers: ${missingHeaders.join(", ")}`
      );
    }

    // Parse and validate amount (should be a valid bigint string)
    let amount: bigint;
    try {
      amount = BigInt(amountStr!);
      if (amount <= BigInt(0)) {
        throw new Error("Amount must be positive");
      }
    } catch {
      return paymentRequired("Invalid x-amount header: must be a valid positive integer");
    }

    // Build payment data object for schema validation
    const paymentData = {
      listing_id: listingId!,
      amount,
      tx_hash: txHash!,
      signature: signature!,
    };

    // Validate against x402PaymentSchema
    const parsed = x402PaymentSchema.safeParse(paymentData);

    if (!parsed.success) {
      const errors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return paymentRequired(`Invalid payment data: ${errors.join("; ")}`);
    }

    const validatedPayment = parsed.data;

    // Check for replay attack - verify tx_hash doesn't exist in transactions
    const supabase = await createClient();

    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id, payment_tx_hash")
      .eq("payment_tx_hash", validatedPayment.tx_hash)
      .single();

    if (existingTx) {
      // Transaction already exists - this is a replay attack
      return conflict(
        `Transaction ${validatedPayment.tx_hash} has already been processed`
      );
    }

    // Extract consumer_id from the request context if available
    // This assumes withAuth was already applied and set request.auth
    const authContext = (request as PaymentRequest).auth;
    const consumerWalletAddress = authContext?.wallet_address;

    // Get consumer_id from wallet address
    let consumerId: string | null = null;

    if (consumerWalletAddress) {
      const { data: consumer } = await supabase
        .from("consumers")
        .select("id")
        .eq("wallet_address", consumerWalletAddress)
        .single();

      consumerId = consumer?.id ?? null;
    }

    // If no consumer found, reject the payment
    if (!consumerId) {
      return paymentRequired(
        "Consumer not found for the authenticated wallet address"
      );
    }

    // Split amount: 90% provider, 10% platform
    const providerAmount = (validatedPayment.amount * 90n) / 100n;
    const platformAmount = validatedPayment.amount - providerAmount;

    // Insert the new transaction atomically
    // The uniqueness constraint on payment_tx_hash at the database level acts as a safety net
    const { error: insertError } = await supabase
      .from("transactions")
      .insert({
        listing_id: validatedPayment.listing_id,
        consumer_id: consumerId,
        payment_tx_hash: validatedPayment.tx_hash,
        amount_usdc: validatedPayment.amount.toString(),
        provider_amount_usdc: providerAmount.toString(),
        platform_amount_usdc: platformAmount.toString(),
        status: "pending",
      });

    if (insertError) {
      // Handle potential race condition where another request inserted the same tx_hash
      if (insertError.code === "23505") {
        // PostgreSQL unique violation code
        return conflict(
          `Transaction ${validatedPayment.tx_hash} has already been processed`
        );
      }
      console.error("[x402] Failed to insert transaction:", insertError);
      return serverError("Failed to record payment transaction");
    }

    // Create payment context with validated data
    const paymentContext: PaymentContext = {
      ...(authContext ?? { wallet_address: "" }),
      payment: {
        listing_id: validatedPayment.listing_id,
        amount: validatedPayment.amount,
        tx_hash: validatedPayment.tx_hash,
        signature: validatedPayment.signature,
      },
    };

    // Create extended request with payment context
    const paymentRequest = request as PaymentRequest;
    paymentRequest.payment = paymentContext.payment;

    // Create context object for the handler
    const context: T = paymentContext as T;

    // Call the actual handler with payment context
    try {
      return await handler(paymentRequest, context);
    } catch (error) {
      console.error("[x402] Handler error:", error);
      return serverError("Internal server error processing payment");
    }
  };
}

/**
 * Creates a 402 Payment Required response
 */
export function paymentRequired(message: string): Response {
  return NextResponse.json({ error: message }, { status: 402 });
}

/**
 * Creates a 409 Conflict response (for replay attacks)
 */
export function conflict(message: string): Response {
  return NextResponse.json({ error: message }, { status: 409 });
}

/**
 * Creates a 500 Internal Server Error response
 */
export function serverError(message: string): Response {
  return NextResponse.json({ error: message }, { status: 500 });
}
