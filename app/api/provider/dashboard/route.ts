import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyJWT } from "@/lib/jwt";

export const runtime = "nodejs";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized: valid JWT required" }, { status: 401 });
    }

    let walletAddress: string;
    try {
      const payload = await verifyJWT(token);
      walletAddress = payload.wallet_address as string;
      if (!walletAddress) throw new Error("Missing wallet_address");
    } catch {
      return NextResponse.json({ error: "Unauthorized: valid JWT required" }, { status: 401 });
    }

    const supabase = supabaseAdmin;

    // Fetch Provider
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, name, pending_earnings_usdc, total_earned_usdc")
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
        status, 
        delegation_id
      `)
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false });

    if (listingsError) throw listingsError;

    // Fetch transactions (for transaction history table)
    // We get transactions for this provider's listings
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
          listings!inner (
            model_name
          )
        `)
        .in("listing_id", listingIds)
        .order("created_at", { ascending: false })
        .limit(50); // Get latest 50 for the dashboard

      if (txError) throw txError;
      
      transactions = (txData || []).map(tx => ({
        id: tx.id,
        txHash: tx.payment_tx_hash,
        amountUsdc: tx.provider_amount_usdc,
        modelName: (tx.listings as { model_name?: string })?.model_name,
        status: tx.status,
        timestamp: tx.created_at,
        completedAt: tx.completed_at
      }));
    }

    // Fetch claim history (for withdrawals tab)
    const { data: claimData, error: claimError } = await supabase
      .from("claim_history")
      .select("id, tx_hash, amount_usdc, status, created_at, completed_at")
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
      completedAt: claim.completed_at
    }));

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        name: provider.name,
        walletAddress: walletAddress,
        pendingEarningsUsdc: provider.pending_earnings_usdc,
        totalEarnedUsdc: provider.total_earned_usdc
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
        delegationId: l.delegation_id
      })),
      transactions,
      claims
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
