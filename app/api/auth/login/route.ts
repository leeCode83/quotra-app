import { NextRequest, NextResponse } from "next/server";
import { recoverMessageAddress } from "viem";
import { consumeNonce, signJWT } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { address, signature, message } = await request.json();

    if (!address || !signature || !message) {
      return NextResponse.json(
        { error: "Missing required fields: address, signature, message" },
        { status: 400 },
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const nonce = consumeNonce(address);
    if (!nonce) {
      return NextResponse.json(
        { error: "Nonce expired or not found. Request a new nonce." },
        { status: 401 },
      );
    }

    const expectedMessage = `Quotra Login: ${nonce}`;
    if (message !== expectedMessage) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const recoveredAddress = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "Signature does not match address" }, { status: 401 });
    }

    const jwt = await signJWT(address);

    return NextResponse.json({ success: true, jwt, expiresIn: 3600 });
  } catch (err) {
    console.error("[auth/login] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
