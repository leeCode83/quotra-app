/**
 * Quotra Gateway helpers.
 *
 * Business-logic utilities used by the x402-gated chat endpoint.
 * JWT verification and permission lookup are removed — x402 payment
 * verification via @x402/next replaces both.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { GatewayRequestInput } from "@/lib/validators";

export class GatewayError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = "GatewayError";
  }
}

export async function getActiveListing(supabase: SupabaseClient, delegationId: string) {
  const { data: listing, error } = await supabase
    .from("listings")
    .select(
      "id, status, expires_at, remaining_calls, max_input_chars, max_completion_tokens, price_per_call_usdc, encrypted_key, key_iv, key_auth_tag, provider_id, model_name",
    )
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
  maxCompletionTokens: number,
) {
  const totalInputChars = body.chat.length + (body.systemPrompt?.length ?? 0);
  if (totalInputChars > maxInputChars) {
    throw new GatewayError(
      `Input exceeds maximum allowed characters (${totalInputChars} > ${maxInputChars})`,
      400,
      "REQUEST_TOO_LARGE",
    );
  }

  if (body.maxOutputTokens && body.maxOutputTokens > maxCompletionTokens) {
    throw new GatewayError(
      `Requested maxOutputTokens exceeds allowed limit (${body.maxOutputTokens} > ${maxCompletionTokens})`,
      400,
      "REQUEST_TOO_LARGE",
    );
  }
}

export async function reserveQuotaSlot(supabase: SupabaseClient, listingId: string) {
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
  listingId: string,
  pricePerCallUsdc: number,
  usage: Record<string, unknown>,
) {
  const amountUsdc = pricePerCallUsdc.toFixed(6);
  const providerAmount = (pricePerCallUsdc * 0.9).toFixed(6);
  const platformAmount = (pricePerCallUsdc * 0.1).toFixed(6);

  await supabase.from("transactions").insert({
    listing_id: listingId,
    amount_usdc: amountUsdc,
    provider_amount_usdc: providerAmount,
    platform_amount_usdc: platformAmount,
    status: "completed",
    completed_at: new Date().toISOString(),
    prompt_tokens: (usage as { prompt_tokens?: number }).prompt_tokens ?? null,
    completion_tokens: (usage as { completion_tokens?: number }).completion_tokens ?? null,
  });
}

export async function accumulateProviderEarnings(
  supabase: SupabaseClient,
  providerId: string,
  pricePerCallUsdc: number,
) {
  const { data: provider } = await supabase
    .from("providers")
    .select("pending_earnings_usdc, total_earned_usdc")
    .eq("id", providerId)
    .single();

  if (provider) {
    const currentPending = parseFloat(provider.pending_earnings_usdc || "0");
    const platformFee = pricePerCallUsdc * 0.1;
    const providerAmount = pricePerCallUsdc - platformFee;
    const newPending = (currentPending + providerAmount).toFixed(6);

    await supabase.from("providers").update({ pending_earnings_usdc: newPending }).eq("id", providerId);
  }
}
