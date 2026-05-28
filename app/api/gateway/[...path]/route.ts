import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { verifyJWT } from "@/lib/jwt";
import { decrypt, importKey } from "@/lib/encryption";
import { createClient } from "@/lib/supabase-server";
import type { JwtPayload, ListingWithProvider, ConsumerPermission } from "@/types";

const VENICE_API_BASE = "https://api.venice.ai/api/v1";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
});
const server = new x402ResourceServer(facilitatorClient);
server.register("eip155:84532", new ExactEvmScheme());

async function handler(request: NextRequest): Promise<NextResponse> {
  const method = request.method as "GET" | "POST";

  // Derive Venice path from the request URL (e.g. /api/gateway/v1/chat/completions → /v1/chat/completions)
  const url = request.nextUrl;
  const pathStr = url.pathname.replace(/^\/api\/gateway\//, "");
  const venicePath = "/" + pathStr;

  // ── 1. Extract & validate JWT ──────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }
  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    const result = await verifyJWT(token);
    payload = result as unknown as JwtPayload;
  } catch {
    return NextResponse.json({ error: "Invalid or expired JWT" }, { status: 401 });
  }

  if (!payload.consumer_id || !payload.listing_id) {
    return NextResponse.json(
      { error: "JWT missing required claims (consumer_id, listing_id)" },
      { status: 401 },
    );
  }

  // ── 2. Verify consumer permission for this listing ─────────────────────────
  const supabase = await createClient();

  const { data: permission, error: permError } = await supabase
    .from("consumer_permissions")
    .select("*")
    .eq("consumer_id", payload.consumer_id)
    .eq("listing_id", payload.listing_id)
    .maybeSingle();

  if (permError) {
    console.error("[gateway] Permission query error:", permError);
    return NextResponse.json(
      { error: "Database error checking permissions" },
      { status: 500 },
    );
  }

  if (!permission) {
    return NextResponse.json(
      { error: "Consumer does not have permission for this listing" },
      { status: 403 },
    );
  }

  const perm = permission as unknown as ConsumerPermission;

  if (perm.expires_at && new Date(perm.expires_at) < new Date()) {
    return NextResponse.json({ error: "Permission has expired" }, { status: 403 });
  }

  // ── 3. Get listing & decrypt provider API key ──────────────────────────────
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*, provider:providers(*)")
    .eq("id", payload.listing_id)
    .eq("is_active", true)
    .single();

  if (listingError || !listing) {
    return NextResponse.json(
      { error: "Listing not found or not active" },
      { status: 404 },
    );
  }

  const listingWithProvider = listing as unknown as ListingWithProvider;
  const provider = listingWithProvider.provider;

  if (!provider?.encrypted_api_key) {
    return NextResponse.json(
      { error: "Provider has no API key configured" },
      { status: 500 },
    );
  }

  const encryptionKeyStr = process.env.QUOTRA_ENCRYPTION_KEY;
  if (!encryptionKeyStr) {
    console.error("[gateway] QUOTRA_ENCRYPTION_KEY not set");
    return NextResponse.json(
      { error: "Server encryption key not configured" },
      { status: 500 },
    );
  }

  let apiKey: string;
  try {
    const key = await importKey(encryptionKeyStr);
    apiKey = await decrypt(JSON.parse(provider.encrypted_api_key), key);
  } catch (err) {
    console.error("[gateway] API key decryption failed:", err);
    return NextResponse.json(
      { error: "Failed to decrypt provider API key" },
      { status: 500 },
    );
  }

  // ── 4. Build Venice AI request ─────────────────────────────────────────────
  const veniceUrl = `${VENICE_API_BASE}${venicePath}`;

  const veniceRequestHeaders = new Headers();
  veniceRequestHeaders.set("Authorization", `Bearer ${apiKey}`);
  veniceRequestHeaders.set("Content-Type", "application/json");

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

  // ── 5. Proxy to Venice AI with streaming ───────────────────────────────────
  let veniceResponse: Response;
  try {
    veniceResponse = await fetch(veniceUrl, {
      method,
      headers: veniceRequestHeaders,
      body,
      // @ts-expect-error - duplex is required for streaming in Node 18
      duplex: "half",
      redirect: "follow",
    });
  } catch (err) {
    console.error("[gateway] Venice fetch error:", err);
    return NextResponse.json(
      { error: "Failed to reach Venice AI" },
      { status: 502 },
    );
  }

  if (!veniceResponse.ok && veniceResponse.status !== 200) {
    const text = await veniceResponse.text().catch(() => "");
    console.error(`[gateway] Venice error ${veniceResponse.status}:`, text);
    return NextResponse.json(
      { error: `Venice AI error: ${veniceResponse.status}` },
      { status: 502 },
    );
  }

  // ── 6. Stream response back to client ─────────────────────────────────────
  const contentType = veniceResponse.headers.get("content-type") ?? "";
  const isStreaming =
    contentType.includes("text/event-stream") ||
    contentType.includes("stream");

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

  const data = await veniceResponse.json().catch(() => null);
  return NextResponse.json(data, { status: 200 });
}

const routeConfig = {
  accepts: {
    scheme: "exact",
    payTo: process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? "",
    price: "$0.01" as const,
    network: "eip155:84532" as const,
  },
  description: "AI API Gateway - pay per request",
  mimeType: "application/json",
};

export const GET = withX402(handler, routeConfig, server);
export const POST = withX402(handler, routeConfig, server);
