import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { verifyJWT } from "@/lib/jwt";
import { decrypt, importKey } from "@/lib/encryption";
import { createClient } from "@/lib/supabase-server";
import { send7710Transaction, getStatus, estimate7710Transaction } from "@/lib/oneshot";
import type { JwtPayload, ListingWithProvider, ConsumerPermission } from "@/types";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
});
const server = new x402ResourceServer(facilitatorClient);
server.register("eip155:84532", new ExactEvmScheme());

async function delegationHandler(request: NextRequest): Promise<NextResponse> {
  const method = request.method as "GET" | "POST";
  const supabase = await createClient();

  const url = request.nextUrl;
  const pathStr = url.pathname.replace(/^\/api\/gateway\//, "");
  const targetPath = "/" + pathStr;

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

  const { data: permission, error: permError } = await supabase
    .from("consumer_permissions")
    .select("*")
    .eq("consumer_id", payload.consumer_id)
    .eq("listing_id", payload.listing_id)
    .maybeSingle();

  if (permError) {
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

  const delegationId = request.headers.get("x-delegation-id");
  if (!delegationId) {
    return NextResponse.json(
      { error: "x-delegation-id header is required for delegation flow" },
      { status: 400 },
    );
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*, provider:providers(*)")
    .eq("id", payload.listing_id)
    .eq("status", "active")
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
    return NextResponse.json(
      { error: "Server encryption key not configured" },
      { status: 500 },
    );
  }

  let apiKey: string;
  try {
    const key = await importKey(encryptionKeyStr);
    apiKey = await decrypt(JSON.parse(provider.encrypted_api_key), key);
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt provider API key" },
      { status: 500 },
    );
  }

  const baseEndpoint = listingWithProvider.endpoint_url!.replace(/\/+$/, "");
  const targetUrl = `${baseEndpoint}${targetPath}`;

  const proxyHeaders = new Headers();
  proxyHeaders.set("Authorization", `Bearer ${apiKey}`);
  proxyHeaders.set("Content-Type", "application/json");

  for (const h of ["accept", "content-type"]) {
    const v = request.headers.get(h);
    if (v) proxyHeaders.set(h, v);
  }

  let body: string | undefined;
  if (method === "POST") {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  let providerResponse: Response;
  try {
    providerResponse = await fetch(targetUrl, {
      method,
      headers: proxyHeaders,
      body,
      // @ts-expect-error - duplex required for streaming in Node 18
      duplex: "half",
      redirect: "follow",
    });
  } catch (err) {
    console.error("[gateway] Provider fetch error:", err);
    return NextResponse.json(
      { error: "Failed to reach provider API" },
      { status: 502 },
    );
  }

  if (!providerResponse.ok && providerResponse.status !== 200) {
    const text = await providerResponse.text().catch(() => "");
    console.error(`[gateway] Provider error ${providerResponse.status}:`, text);
    return NextResponse.json(
      { error: `Provider API error: ${providerResponse.status}` },
      { status: 502 },
    );
  }

  const contentType = providerResponse.headers.get("content-type") ?? "";
  const isStreaming =
    contentType.includes("text/event-stream") || contentType.includes("stream");

  if (isStreaming) {
    const providerStream = providerResponse.body;
    if (!providerStream) {
      return new NextResponse("Provider returned empty stream", { status: 502 });
    }

    const reader = providerStream.getReader();
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

  const data = await providerResponse.json().catch(() => null);
  return NextResponse.json(data, { status: 200 });
}

async function handler(request: NextRequest): Promise<NextResponse> {
  if (request.headers.get("x-delegation-id")) {
    return delegationHandler(request);
  }

  const method = request.method as "GET" | "POST";

  const url = request.nextUrl;
  const pathStr = url.pathname.replace(/^\/api\/gateway\//, "");
  const targetPath = "/" + pathStr;

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

  const supabase = await createClient();

  const { data: permission, error: permError } = await supabase
    .from("consumer_permissions")
    .select("*")
    .eq("consumer_id", payload.consumer_id)
    .eq("listing_id", payload.listing_id)
    .maybeSingle();

  if (permError) {
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

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*, provider:providers(*)")
    .eq("id", payload.listing_id)
    .eq("status", "active")
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
    return NextResponse.json(
      { error: "Server encryption key not configured" },
      { status: 500 },
    );
  }

  let apiKey: string;
  try {
    const key = await importKey(encryptionKeyStr);
    apiKey = await decrypt(JSON.parse(provider.encrypted_api_key), key);
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt provider API key" },
      { status: 500 },
    );
  }

  const baseEndpoint = listingWithProvider.endpoint_url!.replace(/\/+$/, "");
  const targetUrl = `${baseEndpoint}${targetPath}`;

  const proxyHeaders = new Headers();
  proxyHeaders.set("Authorization", `Bearer ${apiKey}`);
  proxyHeaders.set("Content-Type", "application/json");

  for (const h of ["accept", "content-type"]) {
    const v = request.headers.get(h);
    if (v) proxyHeaders.set(h, v);
  }

  let body: string | undefined;
  if (method === "POST") {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  let providerResponse: Response;
  try {
    providerResponse = await fetch(targetUrl, {
      method,
      headers: proxyHeaders,
      body,
      // @ts-expect-error - duplex required for streaming in Node 18
      duplex: "half",
      redirect: "follow",
    });
  } catch (err) {
    console.error("[gateway] Provider fetch error:", err);
    return NextResponse.json(
      { error: "Failed to reach provider API" },
      { status: 502 },
    );
  }

  if (!providerResponse.ok && providerResponse.status !== 200) {
    const text = await providerResponse.text().catch(() => "");
    console.error(`[gateway] Provider error ${providerResponse.status}:`, text);
    return NextResponse.json(
      { error: `Provider API error: ${providerResponse.status}` },
      { status: 502 },
    );
  }

  const contentType = providerResponse.headers.get("content-type") ?? "";
  const isStreaming =
    contentType.includes("text/event-stream") || contentType.includes("stream");

  if (isStreaming) {
    const providerStream = providerResponse.body;
    if (!providerStream) {
      return new NextResponse("Provider returned empty stream", { status: 502 });
    }

    const reader = providerStream.getReader();
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

  const data = await providerResponse.json().catch(() => null);
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
