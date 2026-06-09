import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";


export async function GET() {
  try {
    const supabase = await createClient();
    const { data: listings, error } = await supabase
      .from("listings")
      .select(
        "id, name, model_name, price_per_call_usdc, max_calls, remaining_calls, max_input_chars, max_completion_tokens, status, expires_at, created_at, providers ( wallet_address )"
      )
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch listings", details: error.message },
        { status: 500 }
      );
    }

    const formatted = (listings ?? []).map((item: Record<string, unknown>) => {
      const wallet = (item.providers as Array<Record<string, unknown>>)?.[0]?.wallet_address as string | undefined;
      const providerWallet = wallet ? wallet.slice(0, 6) + "..." + wallet.slice(-4) : null;

      return {
        id: item.id,
        name: item.name,
        modelName: item.model_name,
        pricePerCallUsdc: item.price_per_call_usdc,
        maxCalls: item.max_calls,
        remainingCalls: item.remaining_calls,
        providerWallet,
        createdAt: item.created_at,
        expiresAt: item.expires_at,
      };
    });

    return NextResponse.json({ success: true, listings: formatted });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

