import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyJWT, signJWT } from "@/lib/jwt";

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
    if (typeof wallet === "string") return wallet;
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

    const supabase = await createClient();

    let { data: consumer, error: consumerError } = await supabase
      .from("consumers")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (!consumer) {
      const { data: newConsumer, error: createError } = await supabase
        .from("consumers")
        .insert({ wallet_address: walletAddress })
        .select("id")
        .single();

      if (createError || !newConsumer) {
        return NextResponse.json(
          { error: "Failed to register consumer", details: createError?.message },
          { status: 500 }
        );
      }

      consumer = newConsumer;
    }

    const body = await request.json();
    const { listing_id, erc7715_proof, expires_at } = body;

    if (!listing_id || !erc7715_proof || !expires_at) {
      return NextResponse.json(
        { error: "Missing required fields: listing_id, erc7715_proof, expires_at" },
        { status: 400 }
      );
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, status")
      .eq("id", listing_id)
      .eq("status", "active")
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: "Listing not found or not active" },
        { status: 404 }
      );
    }

    const { data: existingPerm } = await supabase
      .from("consumer_permissions")
      .select("id")
      .eq("consumer_id", consumer.id)
      .eq("listing_id", listing_id)
      .maybeSingle();

    let permissionId: string;

    if (existingPerm) {
      permissionId = existingPerm.id;
      const { error: updateError } = await supabase
        .from("consumer_permissions")
        .update({
          erc7715_proof,
          expires_at,
          status: "active",
        })
        .eq("id", permissionId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update permission", details: updateError.message },
          { status: 500 }
        );
      }
    } else {
      const { data: newPerm, error: insertError } = await supabase
        .from("consumer_permissions")
        .insert({
          consumer_id: consumer.id,
          listing_id,
          erc7715_proof,
          expires_at,
          status: "active",
        })
        .select("id")
        .single();

      if (insertError || !newPerm) {
        return NextResponse.json(
          { error: "Failed to create permission", details: insertError?.message },
          { status: 500 }
        );
      }

      permissionId = newPerm.id;
    }

    const token = await signJWT({
      wallet_address: walletAddress,
      consumer_id: consumer.id,
      listing_id,
      permission_id: permissionId,
    });

    return NextResponse.json({
      success: true,
      permissionId,
      expiresAt: expires_at,
      token,
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
