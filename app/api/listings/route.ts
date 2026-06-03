import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyJWT } from "@/lib/jwt";
import { listingSchema } from "@/lib/validators";
import { executeAsDelegator } from "@/lib/oneshot";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

async function getWalletAddress(request: NextRequest): Promise<string | null> {
  const token = getAuthToken(request);
  if (!token) return null;
  try {
    const payload = await verifyJWT(token);
    const wallet = payload.wallet_address;
    if (typeof wallet === "string") return wallet.toLowerCase();
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: listings, error } = await supabase
      .from("listings")
      .select(
        "id, name, model_name, price_per_call_usdc, max_calls, remaining_calls, max_input_chars, max_completion_tokens, status, expires_at, created_at, providers ( wallet_address )"
      )
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch listings", details: error.message },
        { status: 500 }
      );
    }

    const formatted = (listings ?? []).map((item: Record<string, unknown>) => {
      const wallet = (item.providers as Array<Record<string, unknown>>)?.[0]?.wallet_address as string | undefined;
      const providerWallet = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : null;

      return {
        id: item.id,
        name: item.name,
        modelName: item.model_name,
        pricePerCallUsdc: item.price_per_call_usdc,
        maxCalls: item.max_calls,
        remainingCalls: item.remaining_calls,
        providerWallet,
        createdAt: item.created_at,
        expiresAt: item.expires_at,
      };
    });

    return NextResponse.json({ success: true, listings: formatted });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const walletAddress = await getWalletAddress(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: valid JWT required" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .ilike("wallet_address", walletAddress)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = listingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    if (parseResult.data.provider_id !== provider.id) {
      return NextResponse.json(
        { error: "Forbidden: provider ID mismatch" },
        { status: 403 }
      );
    }

    const data = parseResult.data;

    const { data: listing, error } = await supabase
      .from("listings")
      .insert({
        provider_id: provider.id,
        name: data.name,
        model_name: data.model_name,
        price_per_call_usdc: data.price_per_call_usdc,
        max_calls: data.max_calls,
        remaining_calls: data.max_calls,
        max_input_chars: data.max_input_chars,
        max_completion_tokens: data.max_completion_tokens,
        expires_at: data.expires_at,
        delegation_id: data.delegation_id,
        signed_delegation: data.signed_delegation,
        encrypted_key: data.encrypted_key,
        key_iv: data.key_iv,
        key_auth_tag: data.key_auth_tag,
        status: "active",
      })
      .select()
      .single();

    if (error || !listing) {
      console.error("[listings] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to create listing", details: error?.message },
        { status: 500 }
      );
    }

    // Submit delegation to 1Shot (non-blocking)
    const usdcMethodId = process.env.ONE_SHOT_API_USDC_CONTRACT_METHOD_ID;
    if (usdcMethodId) {
      executeAsDelegator(
        usdcMethodId,
        data.delegation_id,
        { listing_id: listing.id, max_calls: data.max_calls }
      ).catch((err: unknown) => {
        console.warn("[listings] Delegation submission failed (non-blocking):", err);
      });
    }

    return NextResponse.json(
      { success: true, listing },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
