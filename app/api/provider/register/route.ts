import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyJWT } from "@/lib/jwt";
import { providerFullRegistrationSchema } from "@/lib/validators";
import { encrypt } from "@/lib/encryption";
import { executeAsDelegator } from "@/lib/oneshot";

export const runtime = "nodejs";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    let walletAddress: string | undefined;
    if (token) {
      try {
        const payload = await verifyJWT(token);
        walletAddress = (payload as { wallet_address?: string }).wallet_address as string;
      } catch {
        walletAddress = undefined;
      }
    }

    if (!walletAddress) {
      return NextResponse.json({ error: "Unauthorized: valid JWT required" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = providerFullRegistrationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    if (data.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: "Unauthorized: wallet address mismatch" }, { status: 401 });
    }

    const supabase = supabaseAdmin;

    // 1. Get or Create Provider
    const { data: existingProvider } = await supabase
      .from("providers")
      .select("id, name")
      .ilike("wallet_address", walletAddress)
      .maybeSingle();

    let providerId = existingProvider?.id;
    const providerName = existingProvider?.name || data.walletAddress.slice(0, 8); // fallback name

    if (!providerId) {
      const { data: newProvider, error: pError } = await supabase
        .from("providers")
        .insert({ wallet_address: walletAddress, name: providerName })
        .select("id")
        .single();

      if (pError || !newProvider) {
        return NextResponse.json({ error: "Failed to create provider", details: pError?.message }, { status: 500 });
      }
      providerId = newProvider.id;
    }

    // 2. Encrypt Venice API Key
    const { encrypted_key, key_iv, key_auth_tag } = await encrypt(data.veniceApiKey);

    // 3. Generate Delegation ID 
    // In a real flow, delegation ID comes from the signature. For testing/hackathon, we might generate it
    // Wait, the client generates the delegation and signs it, sending signedDelegation object.
    // The client should send delegationId too. But since the schema didn't include delegationId, let's check it.
    // I need to add delegationId to providerFullRegistrationSchema.

    if (!data.delegationId) {
      return NextResponse.json({ error: "Delegation ID is required" }, { status: 400 });
    }

    // 4. Create Listing
    const expiresAtDate = new Date();
    expiresAtDate.setDate(expiresAtDate.getDate() + data.expiryDays);
    const expiresAt = expiresAtDate.toISOString();

    const { data: listing, error: lError } = await supabase
      .from("listings")
      .insert({
        provider_id: providerId,
        name: data.name || `${providerName}'s ${data.modelName} Listing`,
        description: `Access to ${data.modelName} provided by ${providerName}`,
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

    // 5. Submit to 1Shot (non-blocking)
    const usdcMethodId = process.env.ONE_SHOT_API_USDC_CONTRACT_METHOD_ID;
    if (usdcMethodId) {
      executeAsDelegator(usdcMethodId, data.delegationId, { listing_id: listing.id, max_calls: data.maxCalls }).catch(console.warn);
    }

    return NextResponse.json({
      success: true,
      listingId: listing.id,
      delegationId: data.delegationId,
      endpoint: `${process.env.NEXT_PUBLIC_APP_URL || "https://quotra.app"}/api/v1/${data.delegationId}/chat`,
      expiresAt,
    }, { status: 201 });

  } catch (err) {
    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
