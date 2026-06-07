import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createListingSchema } from "@/lib/validators";
import { encrypt } from "@/lib/encryption";
import { executeAsDelegator } from "@/lib/oneshot";

export const runtime = "nodejs";

/**
 * POST /api/providers/listings
 * Creates a new AI service listing for a provider.
 * This also encrypts the provider's API key and delegates to 1Shot.
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get("x-wallet-address")?.toLowerCase();
    if (!walletAddress) {
      return NextResponse.json({ error: "Unauthorized: x-wallet-address header required" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = createListingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    if (data.walletAddress.toLowerCase() !== walletAddress) {
      return NextResponse.json({ error: "Unauthorized: wallet address mismatch" }, { status: 401 });
    }

    const supabase = supabaseAdmin;

    // 1. Get or Create Provider
    const { data: existingProvider } = await supabase
      .from("providers")
      .select("id")
      .ilike("wallet_address", walletAddress)
      .maybeSingle();

    let providerId = existingProvider?.id;
    const providerName = walletAddress.slice(0, 8);

    if (!providerId) {
      const { data: newProvider, error: pError } = await supabase
        .from("providers")
        .insert({ wallet_address: walletAddress })
        .select("id")
        .single();

      if (pError || !newProvider) {
        return NextResponse.json({ error: "Failed to create provider", details: pError?.message }, { status: 500 });
      }
      providerId = newProvider.id;
    }

    // 2. Encrypt AI Provider API Key
    const { encrypted_key, key_iv, key_auth_tag } = await encrypt(data.apiKey);

    if (!data.signedDelegation) {
      return NextResponse.json({ error: "Signed delegation is required" }, { status: 400 });
    }

    // 3. Create Listing
    const expiresAtDate = new Date();
    expiresAtDate.setDate(expiresAtDate.getDate() + data.expiryDays);
    const expiresAt = expiresAtDate.toISOString();

    const { data: listing, error: lError } = await supabase
      .from("listings")
      .insert({
        provider_id: providerId,
        name: data.name || providerName + "'s " + data.modelName + " Listing",
        model_name: data.modelName,
        price_per_call_usdc: data.pricePerCallUsdc,
        max_calls: data.maxCalls,
        remaining_calls: data.maxCalls,
        max_input_chars: data.maxInputChars,
        max_completion_tokens: data.maxCompletionTokens,
        expires_at: expiresAt,
        delegation_id: data.delegationId,
        signed_delegation: data.signedDelegation,
        encrypted_key: encrypted_key,
        key_iv: key_iv,
        key_auth_tag: key_auth_tag,
        status: "active",
      })
      .select("id")
      .single();

    if (lError || !listing) {
      return NextResponse.json({ error: "Failed to create listing", details: lError?.message }, { status: 500 });
    }

    // 4. Submit to 1Shot (non-blocking)
    const usdcMethodId = process.env.ONE_SHOT_API_USDC_CONTRACT_METHOD_ID;
    if (usdcMethodId) {
      executeAsDelegator(usdcMethodId, [JSON.stringify(data.signedDelegation)], { listing_id: listing.id, max_calls: data.maxCalls }).catch(console.warn);
    }

    return NextResponse.json({
      success: true,
      listingId: listing.id,
      delegationId: data.delegationId,
      endpoint: (process.env.NEXT_PUBLIC_APP_URL || "https://quotra.app") + "/api/v1/" + data.delegationId + "/chat",
      expiresAt,
    }, { status: 201 });

  } catch (err) {
    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
