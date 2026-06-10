import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const { listingId } = await params;
    const { wallet_address } = await req.json();

    if (!wallet_address) {
      return NextResponse.json({ error: "Missing wallet_address" }, { status: 400 });
    }

    const { data: consumer } = await supabase
      .from("consumers")
      .select("id")
      .eq("wallet_address", wallet_address.toLowerCase())
      .single();

    if (!consumer) {
      return NextResponse.json({ hasPermission: false });
    }

    const { data, error } = await supabase
      .from("consumer_permissions")
      .select("*")
      .eq("consumer_id", consumer.id)
      .eq("listing_id", listingId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ hasPermission: false });
      }
      console.error("Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch permission" }, { status: 500 });
    }

    return NextResponse.json({
      hasPermission: true,
      permissionContext: JSON.parse(data.erc7715_proof || "null"),
    });
  } catch (error) {
    console.error("POST /api/permissions/[listingId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
