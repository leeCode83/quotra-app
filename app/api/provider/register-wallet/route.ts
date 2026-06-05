import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get("x-wallet-address")?.toLowerCase();
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: x-wallet-address header required" },
        { status: 401 }
      );
    }

    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Check if already registered
    const { data: existing } = await supabase
      .from("providers")
      .select("id, wallet_address, created_at")
      .ilike("wallet_address", walletAddress)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: true, provider: existing, alreadyRegistered: true },
        { status: 200 }
      );
    }

    // Register new provider
    const { data: newProvider, error: insertError } = await supabase
      .from("providers")
      .insert({ wallet_address: walletAddress })
      .select("id, wallet_address, created_at")
      .single();

    if (insertError || !newProvider) {
      return NextResponse.json(
        { error: "Failed to register provider", details: insertError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, provider: newProvider, alreadyRegistered: false },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
