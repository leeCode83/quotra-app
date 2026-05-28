import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyJWT } from "@/lib/jwt";
import { executeMethod } from "@/lib/oneshot";

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
      .select("id, wallet_address")
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
        .select("amount_usdc")
        .in("listing_id", listingIds)
        .eq("status", "completed");

      totalEarnings = (transactions ?? []).reduce(
        (sum, tx) => sum + parseFloat(tx.amount_usdc ?? "0"),
        0
      );
    }

    const { data: claims } = await supabase
      .from("claim_history")
      .select("amount_usdc")
      .eq("provider_id", provider.id)
      .eq("status", "completed");

    const totalClaimed = (claims ?? []).reduce(
      (sum, c) => sum + parseFloat(c.amount_usdc ?? "0"),
      0
    );

    const claimable = Math.max(0, totalEarnings * 0.9 - totalClaimed);

    if (claimable <= 0) {
      return NextResponse.json({
        claimable_amount: 0,
        tx_hash: null,
        status: "skipped",
      });
    }

    if (claimable < 0.001) {
      return NextResponse.json(
        { error: "BELOW_MINIMUM_CLAIM", detail: "Minimum claim is $0.001 USDC" },
        { status: 400 }
      );
    }

    const usdcMethodId = process.env.ONE_SHOT_API_USDC_CONTRACT_METHOD_ID;
    if (!usdcMethodId) {
      return NextResponse.json(
        { error: "USDC transfer method not configured" },
        { status: 500 }
      );
    }

    const usdcDecimals = 6;
    const amountInUSDC = BigInt(Math.floor(claimable * 10 ** usdcDecimals));

    let result: { tx_hash: string; status: string };
    try {
      result = await executeMethod(usdcMethodId, {
        to: provider.wallet_address,
        value: amountInUSDC.toString(),
      });
    } catch (txErr) {
      return NextResponse.json(
        {
          error: "USDC transfer failed",
          details: txErr instanceof Error ? txErr.message : "Unknown error",
        },
        { status: 502 }
      );
    }

    const { error: insertError } = await supabase
      .from("claim_history")
      .insert({
        provider_id: provider.id,
        amount_usdc: String(claimable),
        tx_hash: result.tx_hash,
        status: "pending",
      });

    if (insertError) {
      return NextResponse.json(
        {
          error: "Failed to record claim",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      claimable_amount: claimable,
      tx_hash: result.tx_hash,
      status: result.status,
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
