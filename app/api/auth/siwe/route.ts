import { NextRequest, NextResponse } from "next/server";
import { verifyMessage, type Address } from "viem";
import { signJWT } from "@/lib/jwt";

const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet_address, message, signature } = body;

    if (!wallet_address || typeof wallet_address !== "string" || !WALLET_REGEX.test(wallet_address)) {
      return NextResponse.json({ error: "Invalid wallet_address" }, { status: 400 });
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    if (!signature || typeof signature !== "string") {
      return NextResponse.json({ error: "signature is required" }, { status: 400 });
    }


    const valid = await verifyMessage({
      address: wallet_address as Address,
      message,
      signature: signature as Address,
    });

    if (!valid) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }

    const token = await signJWT({ wallet_address });

    return NextResponse.json({ success: true, token });
  } catch (err) {
    console.error("[auth/siwe] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
