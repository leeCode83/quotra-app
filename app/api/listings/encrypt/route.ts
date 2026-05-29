import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "apiKey is required and must be a string" },
        { status: 400 }
      );
    }

    const rawKeyBase64 = process.env.QUOTRA_ENCRYPTION_KEY;
    if (!rawKeyBase64) {
      return NextResponse.json(
        { error: "Server encryption key not configured (QUOTRA_ENCRYPTION_KEY)" },
        { status: 500 }
      );
    }

    const key = Buffer.from(rawKeyBase64, "base64");
    if (key.length !== 32) {
      return NextResponse.json(
        { error: "QUOTRA_ENCRYPTION_KEY must be 32 bytes (base64)" },
        { status: 500 }
      );
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(apiKey, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return NextResponse.json({
      success: true,
      encrypted_key: encrypted.toString("base64"),
      key_iv: iv.toString("base64"),
      key_auth_tag: authTag.toString("base64"),
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
