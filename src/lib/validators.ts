/**
 * Zod validation schemas for Quotra API
 * Used for validating API requests and form data
 *
 * IMPORTANT: Do NOT use z.string().datetime() - it triggers a circular
 * dependency in zod's internal module graph (ZodISODateTime vs ZodString)
 * when bundled with Turbopack/Next.js. Use manual regex validation instead.
 */

import { z } from "zod";

// Wallet address regex: 0x followed by 40 hex characters
const WALLET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// UUID regex: standard UUID v4 format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 datetime with offset: 2024-01-01T00:00:00.000Z or 2024-01-01T00:00:00+07:00
// Replaces z.string().datetime() which causes a circular dependency in zod's
// bundled module graph with Turbopack in certain module ordering scenarios.
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// Model type enum values
import { isValidModel } from "@/lib/ai-providers/models";

/**
 * Schema for basic provider registration
 */
export const providerWalletSchema = z.object({
  wallet_address: z.string().regex(WALLET_ADDRESS_REGEX, "Invalid wallet address format. Must be 0x followed by 40 hex characters.").transform(val => val.toLowerCase()),
});

/**
 * Inferred type from providerWalletSchema
 */
export type ProviderWallet = z.infer<typeof providerWalletSchema>;

/**
 * Schema for combined provider registration and listing creation
 */
export const createListingSchema = z.object({
  walletAddress: z.string().regex(WALLET_ADDRESS_REGEX, "Invalid wallet address format.").transform(val => val.toLowerCase()),
  name: z.string().min(3, "Name must be at least 3 characters long.").optional(),
  /** API key for the selected AI provider (OpenAI / Anthropic / Google Gemini) */
  apiKey: z.string().min(10, "AI provider API key is required"),
  modelName: z.string().min(1, "Model name is required").regex(/^\S+$/, "Model name cannot contain spaces."),
  pricePerCallUsdc: z.number().min(0.0001).max(1.00),
  maxCalls: z.number().int().min(10).max(100000),
  maxInputChars: z.number().int().min(100).max(8000).default(2000),
  maxCompletionTokens: z.number().int().min(50).max(2000).default(500),
  expiryDays: z.number().int().refine((v) => [7, 14, 30, 90].includes(v), "Expiry must be 7, 14, 30, or 90 days"),
  delegationId: z.string().min(1, "ERC-7715 context is required."),
  permissionsContext: z.union([z.string(), z.record(z.string(), z.unknown())]),
  delegationManager: z.string().min(1, "Delegation manager is required."),
});

/**
 * Inferred type from createListingSchema
 */
export type CreateListing = z.infer<typeof createListingSchema>;

/**
 * Schema for updating an existing listing (e.g. status updates)
 */
export const updateListingSchema = z.object({
  status: z.enum(["active", "paused", "revoked", "expired"]),
});

/**
 * Inferred type from updateListingSchema
 */
export type UpdateListing = z.infer<typeof updateListingSchema>;

/**
 * Schema for creating/updating a listing
 */
export const listingSchema = z.object({
  provider_id: z.string().regex(UUID_REGEX, "Invalid provider ID format."),
  name: z.string().min(3, "Name must be at least 3 characters long."),
  model_name: z.string().min(1, "Model name is required.").regex(/^\S+$/, "Model name cannot contain spaces."),
  price_per_call_usdc: z.number().min(0.0001).max(1.00),
  max_calls: z.number().int().min(10).max(100000),
  max_input_chars: z.number().int().min(100).max(8000).default(2000),
  max_completion_tokens: z.number().int().min(50).max(2000).default(500),
  expires_at: z.string().regex(ISO_DATETIME_REGEX, "Invalid ISO 8601 datetime format. Expected format: 2024-01-01T00:00:00.000Z or with timezone offset"),
  expiry_days: z.number().int().refine((v) => [7, 14, 30, 90].includes(v), "Expiry must be 7, 14, 30, or 90 days").optional(),
  delegation_id: z.string().min(1, "ERC-7715 context is required."),
  permissions_context: z.union([z.string(), z.record(z.string(), z.unknown())]),
  delegation_manager: z.string().min(1, "Delegation manager is required."),
  encrypted_key: z.string().min(1, "Encrypted API key is required."),
  key_iv: z.string().min(1, "Encryption IV is required."),
  key_auth_tag: z.string().min(1, "Encryption auth tag is required."),
});

/**
 * Inferred type from listingSchema
 */
export type ListingInput = z.infer<typeof listingSchema>;

/**
 * Schema for recording a transaction
 */
export const transactionSchema = z.object({
  listing_id: z.string().regex(UUID_REGEX, "Invalid listing ID format."),
  consumer_id: z.string().regex(UUID_REGEX, "Invalid consumer ID format.").optional(),
  payment_tx_hash: z.string().min(1, "Transaction hash is required.").optional(),
  amount_usdc: z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a valid USDC amount."),
  provider_amount_usdc: z.string().regex(/^\d+(\.\d+)?$/, "Provider amount must be valid USDC."),
  platform_amount_usdc: z.string().regex(/^\d+(\.\d+)?$/, "Platform amount must be valid USDC."),
});

/**
 * Inferred type from transactionSchema
 */
export type TransactionInput = z.infer<typeof transactionSchema>;

/**
 * Schema for claiming earnings
 */
export const claimSchema = z.object({
  provider_id: z.string().regex(UUID_REGEX, "Invalid provider ID format."),
  amount_usdc: z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a valid USDC amount."),
  tx_hash: z.string().min(1, "Transaction hash is required."),
});

/**
 * Inferred type from claimSchema
 */
export type ClaimInput = z.infer<typeof claimSchema>;

/**
 * Schema for Gateway request validation.
 * Simplified to 3 fields: chat (required), systemPrompt and maxOutputTokens (optional).
 * The model is determined from the listing - consumer does not choose the model.
 */
export const gatewayRequestSchema = z.object({
  /** Main user message / instruction to the AI */
  chat: z.string().min(1, "chat is required").max(32_000, "chat exceeds 32000 characters"),
  /** Optional system prompt (e.g. persona, context, instructions for the AI) */
  systemPrompt: z.string().max(8_000, "systemPrompt exceeds 8000 characters").optional(),
  /** Max number of output tokens. Capped by listing.max_completion_tokens. Default: 1500 */
  maxOutputTokens: z.number().int().min(1).max(4096).optional(),
});

/**
 * Inferred type from gatewayRequestSchema
 */
export type GatewayRequestInput = z.infer<typeof gatewayRequestSchema>;