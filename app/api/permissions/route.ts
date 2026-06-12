import { NextResponse } from "next/server";
import { createRouteClient, unauthorized } from "@/lib/route-client";

export async function POST(req: Request) {
  try {
    const { supabase, walletAddress } = await createRouteClient(req);
    if (!walletAddress) return unauthorized();

    const { listing_id, permission_context, session_account_address, expires_at } = await req.json();

    if (!listing_id || !permission_context || !session_account_address || !expires_at) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: consumer, error: consumerError } = await supabase
      .from("consumers")
      .upsert(
        { wallet_address: walletAddress.toLowerCase() },
        { onConflict: "wallet_address" }
      )
      .select("id")
      .single();

    if (consumerError || !consumer) {
      return NextResponse.json({ error: "Failed to create/fetch consumer" }, { status: 500 });
    }

    const { error } = await supabase.from("consumer_permissions").insert({
      consumer_id: consumer.id,
      listing_id,
      status: "active",
      expires_at,
      erc7715_proof: JSON.stringify(permission_context),
      granted_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: "Failed to save permission" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
