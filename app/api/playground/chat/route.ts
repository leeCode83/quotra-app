import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createRouteClient, unauthorized } from "@/lib/route-client";
import { decrypt } from "@/lib/encryption";
import { streamAIProvider, AIProviderError } from "@/lib/ai-providers";
import { gatewayRequestSchema } from "@/lib/validators";
import {
  getActiveListing,
  validateRequestLimits,
  reserveQuotaSlot,
  rollbackQuotaSlot,
  GatewayError,
} from "@/lib/gateway/helpers";

const FREE_TRIAL_LIMIT = 3;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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
    
    // We expect listingId in the body or URL, but let's assume body or query.
    // The previous design didn't specify where listingId comes from in the playground route.
    // Let's expect listingId in the request body, or extract from URL search params.
    const url = new URL(request.url);
    const listingId = url.searchParams.get("listingId");

    if (!listingId) {
        return NextResponse.json({ error: "Missing listingId query parameter" }, { status: 400 });
    }

    const { walletAddress: consumerAddress } = await createRouteClient(request);
    if (!consumerAddress) return unauthorized();

    // Check free trial usage
    const { data: trial, error: trialError } = await supabase
      .from("playground_trials")
      .select("calls_count")
      .eq("wallet_address", consumerAddress)
      .eq("listing_id", listingId)
      .single();

    if (trialError && trialError.code !== "PGRST116") { // Ignore 'Not found' error
      throw trialError;
    }

    const currentCalls = trial?.calls_count || 0;
    if (currentCalls >= FREE_TRIAL_LIMIT) {
      return NextResponse.json(
        { error: "Free trial limit reached. Please grant permission to continue using this model." },
        { status: 403 }
      );
    }

    // Validate listing (status, expiry, remaining calls)
    const listing = await getActiveListing(supabase, listingId);

    // Validate input limits against listing constraints
    validateRequestLimits(gatewayBody, listing.max_input_chars, listing.max_completion_tokens);

    // Atomic quota reservation (decrement remaining_calls)
    await reserveQuotaSlot(supabase, listing.id);

    // Call AI provider
    let streamResult;
    try {
      const decryptedKey = await decrypt(
        listing.encrypted_key,
        listing.key_iv,
        listing.key_auth_tag,
      );

      streamResult = await streamAIProvider({
        modelId: listing.model_name,
        apiKey: decryptedKey,
        chat: gatewayBody.chat,
        systemPrompt: gatewayBody.systemPrompt,
        maxOutputTokens: gatewayBody.maxOutputTokens ?? listing.max_completion_tokens,
      });
    } catch (error) {
      await rollbackQuotaSlot(supabase, listing.id);
      throw error;
    }

    // Increment trial count
    if (trial) {
      await supabase
        .from("playground_trials")
        .update({ calls_count: currentCalls + 1, updated_at: new Date().toISOString() })
        .eq("wallet_address", consumerAddress)
        .eq("listing_id", listingId);
    } else {
      await supabase
        .from("playground_trials")
        .insert({
          wallet_address: consumerAddress,
          listing_id: listingId,
          calls_count: 1,
        });
    }

    // Return the response as a text stream
    return streamResult.toTextStreamResponse();

  } catch (error) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[Playground Chat] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
