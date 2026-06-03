import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyJWT } from "@/lib/jwt";
import { listingSchema } from "@/lib/validators";

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

async function verifyListingOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  walletAddress: string
): Promise<{ owned: boolean; providerId?: string; error?: string }> {
  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .ilike("wallet_address", walletAddress)
    .single();

  if (!provider) {
    return { owned: false, error: "Provider not found" };
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("provider_id")
    .eq("id", listingId)
    .single();

  if (!listing) {
    return { owned: false, error: "Listing not found" };
  }

  if (listing.provider_id !== provider.id) {
    return { owned: false, error: "Forbidden: not listing owner" };
  }

  return { owned: true, providerId: provider.id };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const { data: listing, error } = await supabase
      .from("listings")
      .select(
        "id, name, model_name, price_per_call_usdc, max_calls, remaining_calls, max_input_chars, max_completion_tokens, status, expires_at, created_at, providers ( id, wallet_address, created_at )"
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Listing not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch listing", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, listing });
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = await getWalletAddress(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: valid JWT required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const supabase = supabaseAdmin;
    const ownership = await verifyListingOwnership(
      supabase,
      id,
      walletAddress
    );

    if (!ownership.owned) {
      const status = ownership.error?.includes("not found") ? 404 : 403;
      return NextResponse.json({ error: ownership.error }, { status });
    }

    const body = await request.json();
    const updateSchema = listingSchema.partial();
    const parseResult = updateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parseResult.data.name !== undefined)
      updateData.name = parseResult.data.name;
    if (parseResult.data.model_name !== undefined)
      updateData.model_name = parseResult.data.model_name;
    if (parseResult.data.price_per_call_usdc !== undefined)
      updateData.price_per_call_usdc = parseResult.data.price_per_call_usdc;
    if (parseResult.data.max_calls !== undefined) {
      updateData.max_calls = parseResult.data.max_calls;
      updateData.remaining_calls = parseResult.data.max_calls;
    }
    if (parseResult.data.max_input_chars !== undefined)
      updateData.max_input_chars = parseResult.data.max_input_chars;
    if (parseResult.data.max_completion_tokens !== undefined)
      updateData.max_completion_tokens = parseResult.data.max_completion_tokens;
    if (parseResult.data.expires_at !== undefined)
      updateData.expires_at = parseResult.data.expires_at;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data: listing, error } = await supabase
      .from("listings")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !listing) {
      return NextResponse.json(
        { error: "Failed to update listing", details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, listing });
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const walletAddress = await getWalletAddress(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: valid JWT required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const supabase = supabaseAdmin;
    const ownership = await verifyListingOwnership(
      supabase,
      id,
      walletAddress
    );

    if (!ownership.owned) {
      const status = ownership.error?.includes("not found") ? 404 : 403;
      return NextResponse.json({ error: ownership.error }, { status });
    }

    const { error } = await supabase
      .from("listings")
      .update({ status: "revoked" })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete listing", details: error.message },
        { status: 500 }
      );
    }

    await supabase
      .from("consumer_permissions")
      .update({ status: "revoked" })
      .eq("listing_id", id)
      .eq("status", "active");

    return NextResponse.json({ success: true, status: "revoked" });
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
