import { NextRequest } from "next/server";
import { verifyJWT, ConsumerJWTPayload } from "@/lib/jwt";
import { SupabaseClient } from "@supabase/supabase-js";
import { GatewayRequestInput } from "@/lib/validators";

export class GatewayError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = "GatewayError";
  }
}

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

export async function verifyGatewayJWT(token: string): Promise<ConsumerJWTPayload> {
  try {
    const payload = await verifyJWT(token);
    if (!payload.consumerWallet || !payload.delegationId || !payload.permissionId) {
      throw new GatewayError("Invalid JWT: missing required claims", 401, "INVALID_TOKEN");
    }
    // Check expiry
    if (payload.exp && (payload.exp as number) * 1000 < Date.now()) {
        throw new GatewayError("Token expired", 401, "TOKEN_EXPIRED");
    }
    return payload as unknown as ConsumerJWTPayload;
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    throw new GatewayError(`JWT Verification failed: ${err instanceof Error ? err.message : 'Unknown'}`, 401, "INVALID_TOKEN");
  }
}

export async function checkConsumerPermission(
  supabase: SupabaseClient,
  permissionId: string,
  consumerWallet: string,
  delegationId: string
) {
  const { data: permission, error } = await supabase
    .from("consumer_permissions")
    .select("status, expires_at, listings!inner(delegation_id)")
    .eq("id", permissionId)
    .single();

  if (error || !permission) {
    throw new GatewayError("Permission not found", 401, "PERMISSION_NOT_FOUND");
  }

  if (permission.status !== "active") {
    throw new GatewayError("Permission is not active", 401, "PERMISSION_REVOKED");
  }

  if (new Date(permission.expires_at) < new Date()) {
    throw new GatewayError("Permission has expired", 401, "PERMISSION_EXPIRED");
  }

  // Type assertion since postgrest might not strongly type inner joins easily
  const listingDelegationId = (permission.listings as { delegation_id?: string })?.delegation_id;
  if (listingDelegationId !== delegationId) {
    throw new GatewayError("Delegation ID mismatch", 401, "INVALID_DELEGATION");
  }

  return permission;
}

export async function getActiveListing(supabase: SupabaseClient, delegationId: string) {
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, status, expires_at, remaining_calls, max_input_chars, max_completion_tokens, price_per_call_usdc, encrypted_key, key_iv, key_auth_tag, provider_id, model_name")
    .eq("delegation_id", delegationId)
    .single();

  if (error || !listing) {
    throw new GatewayError("Listing not found", 404, "LISTING_NOT_FOUND");
  }

  if (listing.status !== "active") {
    throw new GatewayError("Listing is not active", 410, "LISTING_NOT_ACTIVE");
  }

  if (new Date(listing.expires_at) < new Date()) {
    throw new GatewayError("Listing has expired", 410, "LISTING_EXPIRED");
  }

  if (listing.remaining_calls <= 0) {
    throw new GatewayError("No calls remaining for this listing", 410, "NO_CALLS_REMAINING");
  }

  return listing;
}

export function validateRequestLimits(
  body: GatewayRequestInput,
  maxInputChars: number,
  maxCompletionTokens: number
) {
  const totalInputChars = body.messages.reduce((acc, msg) => acc + msg.content.length, 0);
  if (totalInputChars > maxInputChars) {
    throw new GatewayError(`Input exceeds maximum allowed characters (${totalInputChars} > ${maxInputChars})`, 400, "REQUEST_TOO_LARGE");
  }

  if (body.max_tokens && body.max_tokens > maxCompletionTokens) {
    throw new GatewayError(`Requested max_tokens exceeds allowed limit (${body.max_tokens} > ${maxCompletionTokens})`, 400, "REQUEST_TOO_LARGE");
  }
}

export async function reserveQuotaSlot(supabase: SupabaseClient, listingId: string) {
  // Using an atomic RPC would be best, but we'll try update with match logic first
  // Alternatively, just do an update and check rows affected if possible.
  // We'll use a direct decrement via Supabase postgres if possible, or standard update.
  // Standard Supabase update doesn't support direct decrement easily without RPC,
  // but for hackathon/PoC, we'll fetch then update, or we can use RPC.
  // Assuming no RPC for now, we'll do standard read then update with a condition.
  
  // Actually, we can fetch, decrement, and update. For better concurrency, 
  // RPC `decrement_remaining_calls` is standard. We will just do a standard update for now.
  const { data: listing } = await supabase
    .from("listings")
    .select("remaining_calls")
    .eq("id", listingId)
    .single();

  if (!listing || listing.remaining_calls <= 0) {
    throw new GatewayError("No calls remaining", 410, "NO_CALLS_REMAINING");
  }

  const { error } = await supabase
    .from("listings")
    .update({ remaining_calls: listing.remaining_calls - 1 })
    .eq("id", listingId);

  if (error) {
    throw new GatewayError("Failed to reserve quota", 500, "INTERNAL_ERROR");
  }
}

export async function rollbackQuotaSlot(supabase: SupabaseClient, listingId: string) {
  const { data: listing } = await supabase
    .from("listings")
    .select("remaining_calls")
    .eq("id", listingId)
    .single();
    
  if (listing) {
    await supabase
      .from("listings")
      .update({ remaining_calls: listing.remaining_calls + 1 })
      .eq("id", listingId);
  }
}

export async function recordSuccessTransaction(
  supabase: SupabaseClient,
  txHash: string,
  usage: Record<string, unknown>
) {
  await supabase
    .from("transactions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: { usage }
    })
    .eq("payment_tx_hash", txHash);
}

export async function accumulateProviderEarnings(
  supabase: SupabaseClient,
  providerId: string,
  amountToAddUsdc: string
) {
  // Simple read-modify-write for hackathon. 
  const { data: provider } = await supabase
    .from("providers")
    .select("pending_earnings_usdc, total_earned_usdc")
    .eq("id", providerId)
    .single();

  if (provider) {
    const currentPending = parseFloat(provider.pending_earnings_usdc || "0");
    const addedAmount = parseFloat(amountToAddUsdc);
    const newPending = (currentPending + addedAmount).toFixed(6);

    await supabase
      .from("providers")
      .update({ pending_earnings_usdc: newPending })
      .eq("id", providerId);
  }
}
