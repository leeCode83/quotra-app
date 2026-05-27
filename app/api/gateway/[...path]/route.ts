import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";
import { decrypt, importKey } from "@/lib/encryption";
import { createClient } from "@/lib/supabase-server";
import type { JwtPayload, ListingWithProvider, ConsumerPermission } from "@/types";

// Venice AI base URL
const VENICE_API_BASE = "https://api.venice.ai/api/v1";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyRequest(request, "GET");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyRequest(request, "POST");
}

async function proxyRequest(
  request: NextRequest,
  method: "GET" | "POST",
): Promise<NextResponse> {
  // Derive Venice path from the request URL (e.g. /api/gateway/v1/chat/completions → /v1/chat/completions)
  const url = request.nextUrl;
  const pathStr = url.pathname.replace(/^\/api\/gateway\//, "");
  const venicePath = "/" + pathStr;

  // ── 1. Extract & validate JWT ──────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    const result = await verifyJWT(token);
    payload = result as unknown as JwtPayload;
  } catch {
    return jsonError(401, "Invalid or expired JWT");
  }

  if (!payload.consumer_id || !payload.listing_id) {
    return jsonError(401, "JWT missing required claims (consumer_id, listing_id)");
  }

  // ── 2. Validate x402 payment header ───────────────────────────────────────
  const paymentHeader = request.headers.get("x402-payment");
  if (!paymentHeader) {
    return jsonError(402, "Missing x402-payment header");
  }

  let payment: { tx_hash: string; amount: string; listing_id: string };
  try {
    payment = JSON.parse(paymentHeader);
  } catch {
    return jsonError(400, "Invalid x402-payment JSON");
  }

  if (payment.listing_id !== payload.listing_id) {
    return jsonError(403, "Payment listing_id does not match JWT listing_id");
  }

  // ── 3. Verify consumer permission for this listing ─────────────────────────
  const supabase = await createClient();

  const { data: permission, error: permError } = await supabase
    .from("consumer_permissions")
    .select("*")
    .eq("consumer_id", payload.consumer_id)
    .eq("listing_id", payload.listing_id)
    .maybeSingle();

  if (permError) {
    console.error("[gateway] Permission query error:", permError);
    return jsonError(500, "Database error checking permissions");
  }

  if (!permission) {
    return jsonError(403, "Consumer does not have permission for this listing");
  }

  const perm = permission as unknown as ConsumerPermission;

  // Check expiry
  if (perm.expires_at && new Date(perm.expires_at) < new Date()) {
    return jsonError(403, "Permission has expired");
  }

  // ── 4. Verify & record transaction ──────────────────────────────────────────
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("tx_hash", payment.tx_hash)
    .eq("listing_id", payment.listing_id)
    .maybeSingle();

  if (existingTx) {
    if (existingTx.status === "failed" || existingTx.status === "refunded") {
      return jsonError(402, "Transaction already failed or refunded");
    }
  } else {
    // Record the transaction
    const { error: insertError } = await supabase.from("transactions").insert({
      listing_id: payment.listing_id,
      consumer_id: payload.consumer_id,
      tx_hash: payment.tx_hash,
      amount: payment.amount,
      status: "pending",
    });

    if (insertError) {
      console.error("[gateway] Transaction insert error:", insertError);
      return jsonError(500, "Failed to record transaction");
    }
  }

  // ── 5. Get listing & decrypt provider API key ──────────────────────────────
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*, provider:providers(*)")
    .eq("id", payload.listing_id)
    .eq("is_active", true)
    .single();

  if (listingError || !listing) {
    return jsonError(404, "Listing not found or not active");
  }

  const listingWithProvider = listing as unknown as ListingWithProvider;
  const provider = listingWithProvider.provider;

  if (!provider?.encrypted_api_key) {
    return jsonError(500, "Provider has no API key configured");
  }

  const encryptionKeyStr = process.env.QUOTRA_ENCRYPTION_KEY;
  if (!encryptionKeyStr) {
    console.error("[gateway] QUOTRA_ENCRYPTION_KEY not set");
    return jsonError(500, "Server encryption key not configured");
  }

  let apiKey: string;
  try {
    const key = await importKey(encryptionKeyStr);
    apiKey = await decrypt(JSON.parse(provider.encrypted_api_key), key);
  } catch (err) {
    console.error("[gateway] API key decryption failed:", err);
    return jsonError(500, "Failed to decrypt provider API key");
  }

  // ── 6. Build Venice AI request ─────────────────────────────────────────────
  const VeniceUrl = `${VENICE_API_BASE}${venicePath}`;

  // Extract Venice-specific headers
  const veniceRequestHeaders = new Headers();
  veniceRequestHeaders.set("Authorization", `Bearer ${apiKey}`);
  veniceRequestHeaders.set("Content-Type", "application/json");

  // Forward relevant headers
  const forwardHeaders = [
    "accept",
    "content-type",
    "x-venice-model",
    "x-venice-stream-options",
    "x-venice-inference-params",
  ];
  for (const h of forwardHeaders) {
    const v = request.headers.get(h);
    if (v) veniceRequestHeaders.set(h, v);
  }

  let body: string | undefined;
  if (method === "POST") {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  // ── 7. Proxy to Venice AI with streaming ───────────────────────────────────
  let veniceResponse: Response;
  try {
    veniceResponse = await fetch(VeniceUrl, {
      method,
      headers: veniceRequestHeaders,
      body,
      // @ts-expect-error - duplex is required for streaming in Node 18
      duplex: "half",
      redirect: "follow",
    });
  } catch (err) {
    console.error("[gateway] Venice fetch error:", err);
    return jsonError(502, "Failed to reach Venice AI");
  }

  if (!veniceResponse.ok && veniceResponse.status !== 200) {
    const text = await veniceResponse.text().catch(() => "");
    console.error(`[gateway] Venice error ${veniceResponse.status}:`, text);
    return jsonError(502, `Venice AI error: ${veniceResponse.status}`);
  }

  // ── 8. Stream response back to client ─────────────────────────────────────
  const contentType = veniceResponse.headers.get("content-type") ?? "";
  const isStreaming = contentType.includes("text/event-stream") || contentType.includes("stream");

  if (isStreaming) {
    const veniceStream = veniceResponse.body;
    if (!veniceStream) {
      return new NextResponse("Venice returned empty stream", { status: 502 });
    }

    const reader = veniceStream.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            await markTransactionConfirmed(supabase, payment.tx_hash);
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Non-streaming response
  const data = await veniceResponse.json().catch(() => null);

  // Mark transaction confirmed
  await markTransactionConfirmed(supabase, payment.tx_hash);

  return NextResponse.json(data, { status: 200 });
}

// ── Helper functions ───────────────────────────────────────────────────────────

async function markTransactionConfirmed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  txHash: string,
): Promise<void> {
  await supabase
    .from("transactions")
    .update({ status: "confirmed" })
    .eq("tx_hash", txHash)
    .eq("status", "pending");
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
