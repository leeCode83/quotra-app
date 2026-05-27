import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyJWT } from "@/lib/jwt";
import { listingSchema } from "@/lib/validators";

interface ListingRow {
  id: string;
  name: string;
  description: string | null;
  model_type: string;
  price_per_request: number;
  endpoint_url: string;
  is_active: boolean;
  created_at: string;
  providers: { name: string | null; wallet_address: string | null }[] | null;
}

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

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: listings, error } = await supabase
      .from("listings")
      .select(
        "id, name, description, model_type, price_per_request, endpoint_url, is_active, created_at, providers ( name, wallet_address )"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch listings", details: error.message },
        { status: 500 }
      );
    }

    const formatted = (listings ?? []).map((item: ListingRow) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      model_type: item.model_type,
      price_per_request: item.price_per_request,
      provider_name: item.providers?.[0]?.name ?? null,
      provider_wallet: item.providers?.[0]?.wallet_address ?? null,
      created_at: item.created_at,
    }));

    return NextResponse.json({ success: true, listings: formatted });
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
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = listingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    if (parseResult.data.provider_id !== provider.id) {
      return NextResponse.json(
        { error: "Forbidden: provider ID mismatch" },
        { status: 403 }
      );
    }

    const { data: listing, error } = await supabase
      .from("listings")
      .insert({
        provider_id: provider.id,
        name: parseResult.data.name,
        description: parseResult.data.description,
        model_type: parseResult.data.model_type,
        price_per_request: String(parseResult.data.price_per_request),
        endpoint_url: parseResult.data.endpoint_url,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !listing) {
      console.error("[listings] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to create listing", details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, listing },
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
