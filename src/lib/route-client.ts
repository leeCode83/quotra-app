import { NextResponse } from "next/server";
import { createClient } from "./supabase-server";
import { verifyJWT } from "./auth";

export interface RouteClient {
  supabase: Awaited<ReturnType<typeof createClient>>;
  walletAddress: string | undefined;
}

export async function createRouteClient(
  request: Request,
): Promise<RouteClient> {
  const authHeader = request.headers.get("authorization");
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  let walletAddress: string | undefined;
  if (jwt) {
    const payload = await verifyJWT(jwt);
    if (payload) {
      walletAddress = payload.wallet_address;
    }
  }

  const supabase = await createClient(jwt);

  return { supabase, walletAddress };
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized: valid wallet authentication required" },
    { status: 401 },
  );
}
