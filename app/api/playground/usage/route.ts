import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const FREE_TRIAL_LIMIT = 3;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const listingId = url.searchParams.get("listingId");
    const walletAddress = url.searchParams.get("walletAddress")?.toLowerCase();

    if (!listingId || !walletAddress) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: trial, error } = await supabase
      .from("playground_trials")
      .select("calls_count")
      .eq("wallet_address", walletAddress)
      .eq("listing_id", listingId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const callsCount = trial?.calls_count || 0;
    const remaining = Math.max(0, FREE_TRIAL_LIMIT - callsCount);

    return NextResponse.json({
      callsCount,
      remaining,
      limit: FREE_TRIAL_LIMIT,
      hasTrialRemaining: remaining > 0,
    });
  } catch (error) {
    console.error("[Playground Usage] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
