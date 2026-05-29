import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface OneShotWebhookPayload {
  event: string;
  data: {
    relayer_tx_id?: string;
    tx_hash?: string;
    status: "pending" | "confirmed" | "failed";
    error?: string;
    chain_id?: number;
    method_id?: string;
    wallet_id?: string;
  };
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: OneShotWebhookPayload = await request.json();

    if (!body.event || !body.data) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { relayer_tx_id, tx_hash } = body.data;

    if (relayer_tx_id) {
      const { error: txError } = await supabase
        .from("transactions")
        .update({
          status: body.data.status === "confirmed" ? "completed" : "failed",
          payment_tx_hash: tx_hash ?? undefined,
          completed_at: body.data.status === "confirmed" ? new Date().toISOString() : null,
        })
        .eq("payment_tx_hash", relayer_tx_id);

      if (txError) {
        console.error("[webhook] Failed to update transaction:", txError);
      }
    }

    if (body.data.method_id) {
      const { error: historyError } = await supabase
        .from("claim_history")
        .update({
          status: body.data.status === "confirmed" ? "completed" : "failed",
          tx_hash: tx_hash ?? undefined,
        })
        .eq("tx_hash", tx_hash);

      if (historyError) {
        console.error("[webhook] Failed to update claim history:", historyError);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] Error processing webhook:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
