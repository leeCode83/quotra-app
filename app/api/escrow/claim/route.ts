import { NextRequest, NextResponse } from "next/server";
import { createRouteClient, unauthorized } from "@/lib/route-client";
import { claimViaPermissionlessRelayer } from "@/lib/oneshot/relayer-claim";

export async function GET(request: NextRequest) {
  try {
    const { supabase, walletAddress } = await createRouteClient(request);
    if (!walletAddress) return unauthorized();

    const { data: provider } = await supabase
      .from("providers")
      .select("id")
      .ilike("wallet_address", walletAddress)
      .single();

    if (!provider) {
      return NextResponse.json({ claims: [] });
    }

    const { data: claims } = await supabase
      .from("claim_history")
      .select("*")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false });

    const formatted = (claims ?? []).map((c) => ({
      id: c.id,
      provider_id: c.provider_id,
      amount_usdc: parseFloat(c.amount_usdc ?? "0"),
      tx_hash: c.tx_hash,
      status: c.status === "completed" ? "claimed" : c.status,
      created_at: c.created_at,
    }));

    return NextResponse.json({ claims: formatted });
  } catch (err) {
    console.error("[escrow/claim] GET Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch claims", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { supabase, walletAddress } = await createRouteClient(request);
    if (!walletAddress) return unauthorized();

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, wallet_address, pending_earnings_usdc, total_earned_usdc")
      .ilike("wallet_address", walletAddress)
      .single();

    if (providerError || !provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
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
      .in("status", ["completed", "pending"]);

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

    const amountInUSDC = BigInt(Math.floor(claimable * 10 ** 6));
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/relayer`;

    let taskId: string;
    try {
      const result = await claimViaPermissionlessRelayer(
        provider.wallet_address as `0x${string}`,
        amountInUSDC,
        webhookUrl,
      );
      taskId = result.taskId;
    } catch (txErr) {
      console.error("[claim] Permissionless relayer claim failed:", txErr);
      return NextResponse.json(
        { error: "USDC transfer failed", details: txErr instanceof Error ? txErr.message : "Unknown error" },
        { status: 502 }
      );
    }

    const { error: insertError } = await supabase
      .from("claim_history")
      .insert({
        provider_id: provider.id,
        amount_usdc: String(claimable),
        task_id: taskId,
        status: "pending",
      });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to record claim", details: insertError.message },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("providers")
      .update({
        pending_earnings_usdc: (parseFloat(provider.pending_earnings_usdc || "0") - claimable).toFixed(6),
        total_earned_usdc: (parseFloat(provider.total_earned_usdc || "0") + claimable).toFixed(6),
      })
      .eq("id", provider.id);

    if (updateError) {
      console.error("[claim] Failed to update provider earnings:", updateError);
    }

    return NextResponse.json({
      claimable_amount: claimable,
      task_id: taskId,
      status: "submitted",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
