import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateListingSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * PATCH /api/providers/listings/[listingId]
 * Updates a listing (e.g., status).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const walletAddress = request.headers.get("x-wallet-address")?.toLowerCase();
    if (!walletAddress) {
      return NextResponse.json({ error: "Unauthorized: x-wallet-address header required" }, { status: 401 });
    }

    const { listingId } = await params;
    if (!listingId) {
      return NextResponse.json({ error: "Listing ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = updateListingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Verify ownership
    const { data: listing, error: findError } = await supabase
      .from("listings")
      .select("id, providers!inner(wallet_address)")
      .eq("id", listingId)
      .single();

    if (findError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const listingWallet = (listing.providers as unknown as { wallet_address: string })?.wallet_address?.toLowerCase();
    if (listingWallet !== walletAddress) {
      return NextResponse.json({ error: "Unauthorized: you do not own this listing" }, { status: 403 });
    }

    // Update
    const { error: updateError } = await supabase
      .from("listings")
      .update(parseResult.data)
      .eq("id", listingId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update listing", details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
