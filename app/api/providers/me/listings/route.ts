import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get("x-wallet-address")?.toLowerCase();
    if (!walletAddress) {
      return NextResponse.json({ error: "Unauthorized: x-wallet-address header required" }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: provider } = await supabase
      .from("providers")
      .select("id")
      .ilike("wallet_address", walletAddress)
      .single();

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const { data: listings, error } = await supabase
      .from("listings")
      .select("*")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch listings", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, listings });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
