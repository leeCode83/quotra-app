import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { verifyRelayerWebhook } from "@/lib/oneshot"

type RelayerWebhookType = 0 | 1 | 4

interface RelayerWebhookPayload {
  apiVersion: number
  type: RelayerWebhookType
  data: {
    id: string
    status: number
    memo?: string
    hash?: string
    receipt?: unknown
    message?: string
  }
  timestamp: number
  keyId: string
  signature: string
}

export async function POST(request: NextRequest) {
  try {
    const body: RelayerWebhookPayload = await request.json()

    const valid = await verifyRelayerWebhook(body as unknown as Record<string, unknown>)
    if (!valid) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    if (body.apiVersion === undefined || body.type === undefined || !body.data?.id) {
      return NextResponse.json(
        { error: "Invalid relayer webhook payload" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    if (body.type === 4) {
      if (body.data.hash) {
        const { error } = await supabase
          .from("claim_history")
          .update({ tx_hash: body.data.hash })
          .eq("task_id", body.data.id)

        if (error) console.error("[relayer-webhook] Failed to store tx_hash:", error)
      }
      return NextResponse.json({ received: true })
    }

    if (body.type === 0) {
      const { error } = await supabase
        .from("claim_history")
        .update({
          status: "completed",
          tx_hash: body.data.hash ?? undefined,
        })
        .eq("task_id", body.data.id)

      if (error) console.error("[relayer-webhook] Failed to confirm claim:", error)
      return NextResponse.json({ received: true })
    }

    if (body.type === 1) {
      const { error } = await supabase
        .from("claim_history")
        .update({
          status: "failed",
          tx_hash: body.data.hash ?? undefined,
        })
        .eq("task_id", body.data.id)

      if (error) console.error("[relayer-webhook] Failed to mark claim as failed:", error)
      return NextResponse.json({ received: true })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[relayer-webhook] Error processing webhook:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
