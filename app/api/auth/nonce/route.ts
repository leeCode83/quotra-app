import { NextRequest, NextResponse } from "next/server";
import { generateNonce } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const nonce = generateNonce(address);
    const message = `Quotra Login: ${nonce}`;

    return NextResponse.json({ nonce, message });
  } catch (err) {
    console.error("[auth/nonce] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
