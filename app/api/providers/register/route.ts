import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyJWT } from "@/lib/jwt";
import {
  generateEncryptionKey,
  encrypt,
  exportKey,
  importKey,
} from "@/lib/encryption";
import { providerRegistrationSchema } from "@/lib/validators";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

async function getWalletAddress(request: NextRequest): Promise<string | null> {
  const token = getAuthToken(request);
  if (!token) return null;
  try {
    const payload = await verifyJWT(token);
    const wallet = payload.wallet_address;
    if (typeof wallet === "string") return wallet;
    return null;
  } catch {
    return null;
  }
}

async function getMasterKey(): Promise<CryptoKey> {
  const envKey = process.env.QUOTRA_ENCRYPTION_KEY;
  if (envKey) {
    return importKey(envKey);
  }
  const key = await generateEncryptionKey();
  const exported = await exportKey(key);
  console.warn(
    `[providers/register] QUOTRA_ENCRYPTION_KEY not set. Generated temporary key: ${exported}. Set this as QUOTRA_ENCRYPTION_KEY env var to persist across restarts.`
  );
  return key;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = providerRegistrationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const walletAddress = await getWalletAddress(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: valid JWT required" },
        { status: 401 }
      );
    }

    if (
      parseResult.data.wallet_address.toLowerCase() !==
      walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Unauthorized: wallet address mismatch" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("providers")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Provider already registered for this wallet" },
        { status: 409 }
      );
    }

    const masterKey = await getMasterKey();
    const encrypted = await encrypt(parseResult.data.encrypted_api_key, masterKey);
    const encryptedApiKeyJson = JSON.stringify(encrypted);

    const { data: provider, error } = await supabase
      .from("providers")
      .insert({
        wallet_address: walletAddress,
        name: parseResult.data.name,
        encrypted_api_key: encryptedApiKeyJson,
        delegation_json: parseResult.data.delegation_json ?? null,
        signed_delegation: parseResult.data.signed_delegation ?? null,
        delegation_id: parseResult.data.delegation_id ?? null,
        created_at: new Date().toISOString(),
      })
      .select("id, name")
      .single();

    if (error || !provider) {
      console.error("[providers/register] Insert error:", error);
      return NextResponse.json(
        {
          error: "Failed to register provider",
          details: error?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, provider_id: provider.id, name: provider.name },
      { status: 201 }
    );
  } catch (err) {
    console.error("[providers/register] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const walletAddress = await getWalletAddress(request);
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Unauthorized: valid JWT required" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data: provider, error } = await supabase
      .from("providers")
      .select("id, wallet_address, name, delegation_json, created_at")
      .eq("wallet_address", walletAddress)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch provider", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, provider });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
