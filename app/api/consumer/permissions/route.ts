import { NextRequest, NextResponse } from "next/server";
import { createRouteClient, unauthorized } from "@/lib/route-client";

export const runtime = "nodejs";

/**
 * GET /api/consumer/permissions
 * Mengembalikan daftar active permissions milik consumer berdasarkan wallet address.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, walletAddress } = await createRouteClient(request);
    if (!walletAddress) return unauthorized();

    const { data: consumer } = await supabase
      .from("consumers")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (!consumer) {
      return NextResponse.json({ permissions: [] });
    }

    const { data, error } = await supabase
      .from("consumer_permissions")
      .select(`
        id,
        listing_id,
        status,
        expires_at,
        granted_at,
        listings (
          id,
          name,
          model_name,
          price_per_call_usdc,
          remaining_calls,
          max_calls
        )
      `)
      .eq("consumer_id", consumer.id)
      .order("granted_at", { ascending: false });

    if (error) {
      console.error("GET /api/consumer/permissions error:", error);
      return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
    }

    return NextResponse.json({ permissions: data ?? [] });
  } catch (error) {
    console.error("GET /api/consumer/permissions unhandled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/consumer/permissions
 * Merevoke specific permission milik consumer berdasarkan permission ID.
 * Body: { permissionId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, walletAddress } = await createRouteClient(request);
    if (!walletAddress) return unauthorized();

    const { permissionId } = await request.json();
    if (!permissionId) {
      return NextResponse.json({ error: "permissionId is required" }, { status: 400 });
    }

    const { data: consumer } = await supabase
      .from("consumers")
      .select("id")
      .eq("wallet_address", walletAddress)
      .single();

    if (!consumer) {
      return NextResponse.json({ error: "Unauthorized: you do not own this permission" }, { status: 403 });
    }

    // Verifikasi ownership sebelum revoke
    const { data: permission, error: findError } = await supabase
      .from("consumer_permissions")
      .select("id, consumer_id")
      .eq("id", permissionId)
      .single();

    if (findError || !permission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 });
    }

    if (permission.consumer_id !== consumer.id) {
      return NextResponse.json({ error: "Unauthorized: you do not own this permission" }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from("consumer_permissions")
      .update({ status: "revoked" })
      .eq("id", permissionId);

    if (updateError) {
      console.error("DELETE /api/consumer/permissions error:", updateError);
      return NextResponse.json({ error: "Failed to revoke permission" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/consumer/permissions unhandled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
