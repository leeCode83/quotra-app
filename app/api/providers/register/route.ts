import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { providerRegistrationSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get("x-wallet-address")?.toLowerCase();
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: x-wallet-address header required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = providerRegistrationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    if (parseResult.data.wallet_address.toLowerCase() !== walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: wallet address mismatch" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("providers")
      .select("id")
      .ilike("wallet_address", walletAddress)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Provider already registered for this wallet" },
        { status: 409 }
      );
    }

    const { data: provider, error } = await supabase
      .from("providers")
      .insert({
        wallet_address: walletAddress,
      })
      .select("id")
      .single();

    if (error || !provider) {
      console.error("[providers/register] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to register provider", details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, provider_id: provider.id },
      { status: 201 }
    );
  } catch (err) {
    console.error("[providers/register] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get("x-wallet-address")?.toLowerCase();
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: x-wallet-address header required" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data: provider, error } = await supabase
      .from("providers")
      .select("id, wallet_address, pending_earnings_usdc, total_earned_usdc, created_at")
      .ilike("wallet_address", walletAddress)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch provider", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, provider });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
