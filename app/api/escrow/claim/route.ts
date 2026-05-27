import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyJWT } from "@/lib/jwt";
import { withdrawFromEscrow } from "@/lib/web3/contracts";

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

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    const { data: listings } = await supabase
      .from("listings")
      .select("id")
      .eq("provider_id", provider.id);

    const listingIds = listings?.map((l) => l.id) ?? [];

    let totalEarnings = 0;
    if (listingIds.length > 0) {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount")
        .in("listing_id", listingIds)
        .eq("status", "confirmed");

      totalEarnings = (transactions ?? []).reduce(
        (sum, tx) => sum + (tx.amount ?? 0),
        0
      );
    }

    const { data: claims } = await supabase
      .from("claim_history")
      .select("amount")
      .eq("provider_id", provider.id)
      .eq("status", "claimed");

    const totalClaimed = (claims ?? []).reduce(
      (sum, c) => sum + (c.amount ?? 0),
      0
    );

    const claimable = Math.max(0, totalEarnings * 0.9 - totalClaimed);

    if (claimable <= 0) {
      return NextResponse.json({
        claimable_amount: 0,
        tx_hash: null,
      });
    }

    let txHash: `0x${string}`;
    try {
      txHash = await withdrawFromEscrow(
        walletAddress as `0x${string}`,
        claimable,
      );
    } catch (txErr) {
      return NextResponse.json(
        {
          error: "On-chain withdrawal failed",
          details: txErr instanceof Error ? txErr.message : "Unknown error",
        },
        { status: 502 },
      );
    }

    const { error: insertError } = await supabase
      .from("claim_history")
      .insert({
        provider_id: provider.id,
        amount: claimable,
        tx_hash: txHash,
        status: "claimed",
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      return NextResponse.json(
        {
          error: "Failed to record claim",
          details: insertError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      claimable_amount: claimable,
      tx_hash: txHash,
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
