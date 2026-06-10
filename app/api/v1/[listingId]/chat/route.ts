/**
 * Quotra Gateway — Chat endpoint
 *
 * Payment-gated AI proxy endpoint protected by @x402/next.
 * Consumer flow:
 *   1. Call POST /api/v1/:delegationId/chat with { chat, systemPrompt?, maxOutputTokens? }
 *   2. First call returns 402 with payment requirements
 *   3. Consumer pays USDC → retries with X-PAYMENT header (via x402Fetch or any x402 client)
 *   4. withX402 verifies payment through x402 facilitator → executes handler
 *   5. Handler: validates listing, reserves quota, calls AI provider, records usage
 *
 * No JWT, no manual authorisation headers. Payment proof IS authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { withX402, type RouteConfig } from "@x402/next";
import { type DynamicPrice } from "@x402/core/http";
import { server, QUOTRA_TREASURY_ADDRESS, NETWORK } from "@/x402-config";
import { createClient } from "@/lib/supabase-server";
import { decrypt } from "@/lib/encryption";
import { callAIProvider, AIProviderError } from "@/lib/ai-providers";
import { gatewayRequestSchema } from "@/lib/validators";
import {
  getActiveListing,
  validateRequestLimits,
  reserveQuotaSlot,
  rollbackQuotaSlot,
  recordSuccessTransaction,
  accumulateProviderEarnings,
  GatewayError,
} from "@/lib/gateway/helpers";

export const runtime = "nodejs";

/**
 * Dynamic price resolver.
 * Extracts delegationId from the request path and looks up the listing's
 * price_per_call_usdc to tell the consumer how much to pay.
 *
 * @x402/next calls this on every request (both unpaid 402 intercept and paid retry).
 */
const dynamicPrice: DynamicPrice = async (context) => {
  const match = context.path.match(/\/api\/v1\/([^/]+)\/chat/);
  if (!match) return "$0.001";
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("price_per_call_usdc")
    .eq("id", match[1])
    .single();
  if (!listing) return "$0.001";
  return `$${listing.price_per_call_usdc}`;
};

/**
 * Route-level x402 configuration.
 * - scheme: "exact" = consumer must pay the exact price shown
 * - payTo: static treasury address (all payments settle here)
 * - price: resolved dynamically per-listing via dynamicPrice
 */
const routeConfig: RouteConfig = {
  accepts: [
    {
      scheme: "exact",
      payTo: QUOTRA_TREASURY_ADDRESS,
      price: dynamicPrice,
      network: NETWORK,
      extra: {
        assetTransferMethod: "erc7710",
      },
    },
  ],
  description: "Quotra AI API call",
  mimeType: "application/json",
};

/**
 * Core handler — runs only after x402 payment is verified.
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    const match = request.nextUrl.pathname.match(/\/api\/v1\/([^/]+)\/chat/);
    if (!match) {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }
    const listingId = match[1];

    // Ekstrak wallet address consumer dari header (opsional — digunakan untuk mencatat consumer_id di transaksi)
    const consumerAddress = request.headers.get("x-wallet-address") ?? undefined;

    const supabase = await createClient();

    // Validate listing (status, expiry, remaining calls)
    const listing = await getActiveListing(supabase, listingId);

    // Parse and validate request body
    const bodyText = await request.text();
    let bodyJson: unknown;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = gatewayRequestSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.format() },
        { status: 400 },
      );
    }
    const gatewayBody = parseResult.data;

    // Validate input limits against listing constraints
    validateRequestLimits(gatewayBody, listing.max_input_chars, listing.max_completion_tokens);

    // Atomic quota reservation (decrement remaining_calls)
    await reserveQuotaSlot(supabase, listing.id);

    // Call AI provider
    let aiResponse: { text: string; usage: unknown };
    try {
      const decryptedKey = await decrypt(
        listing.encrypted_key,
        listing.key_iv,
        listing.key_auth_tag,
      );

      aiResponse = await callAIProvider({
        modelId: listing.model_name,
        apiKey: decryptedKey,
        chat: gatewayBody.chat,
        systemPrompt: gatewayBody.systemPrompt,
        maxOutputTokens: gatewayBody.maxOutputTokens,
      });
    } catch (error) {
      await rollbackQuotaSlot(supabase, listing.id);
      throw error;
    }

    // Record success in our DB for usage tracking + provider earnings
    await recordSuccessTransaction(
      supabase,
      listing.id,
      listing.price_per_call_usdc,
      aiResponse.usage as unknown as Record<string, unknown>,
      consumerAddress,
    );

    await accumulateProviderEarnings(supabase, listing.provider_id, listing.price_per_call_usdc);

    return NextResponse.json(aiResponse);
  } catch (error) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[Gateway] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

export const POST = withX402(handler, routeConfig, server);
