import { NextRequest, NextResponse } from "next/server";
import { gatewayRequestSchema } from "@/lib/validators";
import { withAuth, withX402, PaymentRequest, PaymentContext } from "@/middleware";
import { createClient } from "@/lib/supabase-server";
import { decrypt } from "@/lib/encryption";
import { callAIProvider, AIProviderError } from "@/lib/ai-providers";
import {
  verifyGatewayJWT,
  checkConsumerPermission,
  getActiveListing,
  validateRequestLimits,
  reserveQuotaSlot,
  rollbackQuotaSlot,
  recordSuccessTransaction,
  accumulateProviderEarnings,
  GatewayError
} from "@/lib/gateway/helpers";

export const runtime = "nodejs";

// Handle the request wrapped with Auth and X402 middleware
// Note: withX402 expects request to already be authenticated (which we do manually or via chain)
// Let's create the base handler that receives PaymentContext
async function chatHandler(
  request: PaymentRequest,
  context: PaymentContext,
  params: { delegationId: string }
) {
  try {
    const delegationId = params.delegationId;
    const { wallet_address: consumerWallet, payment } = context;

    // Step 1: Verify JWT manually from the Authorization header to get permissionId
    // (withAuth only extracts wallet_address, we need full ConsumerJWTPayload for Gateway)
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      throw new GatewayError("Missing authorization header", 401, "INVALID_TOKEN");
    }
    const token = authHeader.replace("Bearer ", "");
    const jwtPayload = await verifyGatewayJWT(token);

    const supabase = await createClient();

    // Step 2: Permission Check
    await checkConsumerPermission(supabase, jwtPayload.permissionId, consumerWallet, delegationId);

    // Step 3: Listing Validation
    const listing = await getActiveListing(supabase, delegationId);

    // Read and validate body
    const bodyText = await request.text();
    let bodyJson;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      throw new GatewayError("Invalid JSON body", 400, "INVALID_REQUEST");
    }

    const parseResult = gatewayRequestSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.format() },
        { status: 400 }
      );
    }
    const gatewayBody = parseResult.data;

    // Step 4: Validate Input Limits
    validateRequestLimits(gatewayBody, listing.max_input_chars, listing.max_completion_tokens);

    // Steps 5-6: Payment Validation
    // The amount paid must be >= listing.price_per_call_usdc
    // We parse listing price (e.g. 0.01 USDC). The payment.amount is in smallest unit (e.g. 6 decimals for USDC)
    const requiredAmountStr = (listing.price_per_call_usdc * 1_000_000).toFixed(0);
    const requiredAmount = BigInt(requiredAmountStr);
    
    if (payment.amount < requiredAmount) {
      throw new GatewayError(`Insufficient payment. Required: ${requiredAmount}, Paid: ${payment.amount}`, 402, "INSUFFICIENT_FUNDS");
    }

    // (Assuming facilitator verification is done out-of-band or via an external service hook, 
    // for now we trust the x402 headers passed the validator and signature check)

    // Step 7 is already handled by withX402 (Transaction inserted as 'pending' with unique tx_hash)

    // Step 8: Atomic Quota Reservation
    await reserveQuotaSlot(supabase, listing.id);

    // Step 9: AI Provider Call via Vercel AI SDK
    let aiResponse;
    try {
      const decryptedKey = await decrypt(listing.encrypted_key, listing.key_iv, listing.key_auth_tag);

      aiResponse = await callAIProvider({
        modelId: listing.model_name,
        apiKey: decryptedKey,
        chat: gatewayBody.chat,
        systemPrompt: gatewayBody.systemPrompt,
        maxOutputTokens: gatewayBody.maxOutputTokens,
      });
    } catch (error) {
      // Step 10b: Failure -> Rollback Quota
      await rollbackQuotaSlot(supabase, listing.id);

      // Update transaction status to refund_pending
      await supabase
        .from("transactions")
        .update({ status: "refund_pending" })
        .eq("payment_tx_hash", payment.tx_hash);

      throw error; // Re-throw to be caught by outer catch block
    }

    // Step 10a: Success -> Record transaction completion and earnings
    await recordSuccessTransaction(
      supabase,
      payment.tx_hash,
      aiResponse.usage as unknown as Record<string, unknown>
    );
    
    // The custom withX402 already split the provider_amount_usdc (90%) and inserted it.
    // We just need to accumulate it in the provider's pending_earnings_usdc.
    const { data: txData } = await supabase
      .from("transactions")
      .select("provider_amount_usdc")
      .eq("payment_tx_hash", payment.tx_hash)
      .single();

    if (txData?.provider_amount_usdc) {
      await accumulateProviderEarnings(supabase, listing.provider_id, txData.provider_amount_usdc);
    }

    // Return Vercel AI SDK response: { text, usage }
    return NextResponse.json(aiResponse);

  } catch (error) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    // Handle AIProviderError (from Vercel AI SDK wrapper)
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[Gateway] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// Wrap with Auth and then X402
// Next.js App Router API route handlers must export exact HTTP methods
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ delegationId: string }> }
) {
  const resolvedParams = await params;
  
  // We apply the middleware dynamically here since we need to pass params to the final handler
  // withX402 expects an authenticated request with auth context. 
  // We'll wrap the handler in withX402, and wrap that in withAuth.
  
  const finalHandler = async (req: PaymentRequest, ctx: PaymentContext) => {
    return chatHandler(req, ctx, resolvedParams);
  };

  const x402Wrapped = withX402(finalHandler);
  const fullyWrapped = withAuth(x402Wrapped as Parameters<typeof withAuth>[0]);
  
  return fullyWrapped(request);
}
