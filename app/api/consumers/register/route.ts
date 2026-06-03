import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyJWT } from "@/lib/jwt";

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
    if (typeof wallet === "string") return wallet.toLowerCase();
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

    const { data: existing } = await supabase
      .from("consumers")
      .select("id")
      .ilike("wallet_address", walletAddress)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Consumer already registered for this wallet" },
        { status: 409 }
      );
    }

    const { data: consumer, error } = await supabase
      .from("consumers")
      .insert({
        wallet_address: walletAddress,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !consumer) {
      console.error("[consumers/register] Insert error:", error);
      return NextResponse.json(
        {
          error: "Failed to register consumer",
          details: error?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, consumer_id: consumer.id },
      { status: 201 }
    );
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

export async function GET(request: NextRequest) {
  try {
    const walletAddress = await getWalletAddress(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: valid JWT required" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data: consumer, error } = await supabase
      .from("consumers")
      .select("id, wallet_address, name, created_at")
      .ilike("wallet_address", walletAddress)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Consumer not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch consumer", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, consumer });
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
