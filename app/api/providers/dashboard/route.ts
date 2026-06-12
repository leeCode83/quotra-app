import { NextRequest, NextResponse } from "next/server";
import { createRouteClient, unauthorized } from "@/lib/route-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { supabase, walletAddress } = await createRouteClient(request);
    if (!walletAddress) return unauthorized();

    // Fetch Provider
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, pending_earnings_usdc, total_earned_usdc")
      .ilike("wallet_address", walletAddress)
      .single();

    if (providerError) {
      if (providerError.code === "PGRST116") {
         return NextResponse.json({ error: "Provider not found" }, { status: 404 });
      }
      throw providerError;
    }

    // Fetch Listings
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select(`
        id, 
        name, 
        model_name, 
        price_per_call_usdc, 
        remaining_calls, 
        max_calls, 
        expires_at, 
        status 
      `)
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false });

    if (listingsError) throw listingsError;

    // Fetch transactions
    const listingIds = listings ? listings.map(l => l.id) : [];
    let transactions: Record<string, unknown>[] = [];

    if (listingIds.length > 0) {
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select(`
          id,
          payment_tx_hash,
          amount_usdc,
          provider_amount_usdc,
          status,
          created_at,
          completed_at,
          listings!inner (model_name)
        `)
        .in("listing_id", listingIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (txError) throw txError;

      transactions = (txData || []).map(tx => ({
        id: tx.id,
        txHash: tx.payment_tx_hash,
        amountUsdc: tx.provider_amount_usdc,
        modelName: (tx.listings as { model_name?: string })?.model_name,
        status: tx.status,
        timestamp: tx.created_at,
        completedAt: tx.completed_at,
      }));
    }

    // Fetch claim history
    const { data: claimData, error: claimError } = await supabase
      .from("claim_history")
      .select("id, tx_hash, amount_usdc, status, created_at")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (claimError) throw claimError;

    const claims = (claimData || []).map(claim => ({
      id: claim.id,
      txHash: claim.tx_hash,
      amountUsdc: claim.amount_usdc,
      status: claim.status,
      timestamp: claim.created_at,
    }));

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        walletAddress: walletAddress,
        pendingEarningsUsdc: provider.pending_earnings_usdc,
        totalEarnedUsdc: provider.total_earned_usdc,
      },
      listings: (listings || []).map(l => ({
        id: l.id,
        name: l.name,
        modelName: l.model_name,
        pricePerCallUsdc: l.price_per_call_usdc,
        remainingCalls: l.remaining_calls,
        maxCalls: l.max_calls,
        expiresAt: l.expires_at,
        status: l.status,
      })),
      transactions,
      claims,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
