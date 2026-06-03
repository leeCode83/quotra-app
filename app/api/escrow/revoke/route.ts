import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyJWT } from "@/lib/jwt";

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

export async function POST(request: NextRequest) {
  try {
    const walletAddress = await getWalletAddress(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: valid JWT required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const listingId = body?.listing_id;
    if (!listingId || typeof listingId !== "string") {
      return NextResponse.json(
        { error: "Validation failed", details: "listing_id is required" },
        { status: 400 }
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

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("provider_id, status")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    if (listing.provider_id !== provider.id) {
      return NextResponse.json(
        { error: "Forbidden: not listing owner" },
        { status: 403 }
      );
    }

    if (listing.status === "revoked") {
      return NextResponse.json(
        { error: "ALREADY_REVOKED" },
        { status: 410 }
      );
    }

    const { error: revokeError } = await supabase
      .from("listings")
      .update({ status: "revoked" })
      .eq("id", listingId);

    if (revokeError) {
      return NextResponse.json(
        { error: "Failed to revoke listing", details: revokeError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("consumer_permissions")
      .update({ status: "revoked" })
      .eq("listing_id", listingId)
      .eq("status", "active");

    return NextResponse.json({
      listingId,
      status: "revoked",
    });
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
