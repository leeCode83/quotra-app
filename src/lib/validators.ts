/**
 * Zod validation schemas for Quotra API
 * Used for validating API requests and form data
 */

import { z } from "zod";

// Wallet address regex: 0x followed by 40 hex characters
const WALLET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// UUID regex: standard UUID v4 format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Model type enum values
const MODEL_TYPES = [
  "chat",
  "completion",
  "embedding",
  "image",
  "audio",
  "video",
  "other",
] as const;

/**
 * Schema for provider registration
 * Used when a new provider registers with their API key
 */
export const providerRegistrationSchema = z.object({
  wallet_address: z.string().regex(WALLET_ADDRESS_REGEX, "Invalid wallet address format. Must be 0x followed by 40 hex characters."),
  name: z.string().min(3, "Name must be at least 3 characters long."),
  encrypted_api_key: z.string().min(1, "Encrypted API key is required."),
  delegation_json: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Inferred type from providerRegistrationSchema
 */
export type ProviderRegistration = z.infer<typeof providerRegistrationSchema>;

/**
 * Schema for creating/updating a listing
 * Used when providers create AI service offerings
 */
export const listingSchema = z.object({
  provider_id: z.string().regex(UUID_REGEX, "Invalid provider ID format."),
  name: z.string().min(3, "Name must be at least 3 characters long."),
  description: z.string().min(10, "Description must be at least 10 characters long."),
  model_type: z.enum(MODEL_TYPES),
  price_per_request: z.bigint().positive("Price must be a positive number."),
  endpoint_url: z.string().url("Invalid endpoint URL format."),
});

/**
 * Inferred type from listingSchema
 */
export type ListingInput = z.infer<typeof listingSchema>;

/**
 * Schema for granting consumer permission
 * Used when authorizing a consumer to access a listing
 */
export const consumerPermissionSchema = z.object({
  consumer_id: z.string().regex(UUID_REGEX, "Invalid consumer ID format."),
  listing_id: z.string().regex(UUID_REGEX, "Invalid listing ID format."),
  session_key: z.string().regex(WALLET_ADDRESS_REGEX, "Invalid session key format. Must be 0x followed by 40 hex characters."),
  permissions_json: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Inferred type from consumerPermissionSchema
 */
export type ConsumerPermissionInput = z.infer<typeof consumerPermissionSchema>;

/**
 * Schema for recording a transaction
 * Used when logging blockchain transactions
 */
export const transactionSchema = z.object({
  listing_id: z.string().regex(UUID_REGEX, "Invalid listing ID format."),
  consumer_id: z.string().regex(UUID_REGEX, "Invalid consumer ID format."),
  tx_hash: z.string().min(1, "Transaction hash is required."),
  amount: z.bigint().positive("Amount must be a positive number."),
});

/**
 * Inferred type from transactionSchema
 */
export type TransactionInput = z.infer<typeof transactionSchema>;

/**
 * Schema for claiming earnings
 * Used when providers withdraw their earnings
 */
export const claimSchema = z.object({
  provider_id: z.string().regex(UUID_REGEX, "Invalid provider ID format."),
  amount: z.bigint().positive("Amount must be a positive number."),
  tx_hash: z.string().min(1, "Transaction hash is required."),
});

/**
 * Inferred type from claimSchema
 */
export type ClaimInput = z.infer<typeof claimSchema>;

/**
 * Schema for x402 payment format
 * Used for HTTP 402 Payment Required responses
 */
export const x402PaymentSchema = z.object({
  listing_id: z.string().regex(UUID_REGEX, "Invalid listing ID format."),
  amount: z.bigint(),
  tx_hash: z.string().min(1, "Transaction hash is required."),
  signature: z.string().min(1, "Payment signature is required."),
});

/**
 * Inferred type from x402PaymentSchema
 */
export type X402PaymentInput = z.infer<typeof x402PaymentSchema>;