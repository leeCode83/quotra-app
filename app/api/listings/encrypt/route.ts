import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "apiKey is required and must be a string" },
        { status: 400 }
      );
    }

    const { encrypted_key, key_iv, key_auth_tag } = await encrypt(apiKey);

    return NextResponse.json({
      success: true,
      encrypted_key,
      key_iv,
      key_auth_tag,
    });
  } catch (err) {
    console.error("[listings/encrypt] Error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
