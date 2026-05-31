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
import { isValidVeniceModel } from "@/lib/venice/models";
/**
 * Schema for provider registration
 */
export const providerRegistrationSchema = z.object({
  wallet_address: z.string().regex(WALLET_ADDRESS_REGEX, "Invalid wallet address format. Must be 0x followed by 40 hex characters."),
  name: z.string().min(3, "Name must be at least 3 characters long."),
});

/**
 * Inferred type from providerRegistrationSchema
 */
export type ProviderRegistration = z.infer<typeof providerRegistrationSchema>;

/**
 * Schema for combined provider registration and listing creation
 */
export const providerFullRegistrationSchema = z.object({
  walletAddress: z.string().regex(WALLET_ADDRESS_REGEX, "Invalid wallet address format."),
  name: z.string().min(3, "Name must be at least 3 characters long.").optional(),
  veniceApiKey: z.string().min(10, "Venice AI API key required"),
  modelName: z.string().min(1).refine(isValidVeniceModel, "Unsupported Venice AI model"),
  pricePerCallUsdc: z.number().min(0.0001).max(1.00),
  maxCalls: z.number().int().min(10).max(100000),
  maxInputChars: z.number().int().min(100).max(8000).default(2000),
  maxCompletionTokens: z.number().int().min(50).max(2000).default(500),
  expiryDays: z.number().int().refine((v) => [7, 14, 30, 90].includes(v), "Expiry must be 7, 14, 30, or 90 days"),
  delegationId: z.string().min(1, "ERC-7710 delegation ID is required."),
  signedDelegation: z.record(z.string(), z.unknown()),
});

/**
 * Inferred type from providerFullRegistrationSchema
 */
export type ProviderFullRegistration = z.infer<typeof providerFullRegistrationSchema>;

/**
 * Schema for creating/updating a listing
 */
export const listingSchema = z.object({
  provider_id: z.string().regex(UUID_REGEX, "Invalid provider ID format."),
  name: z.string().min(3, "Name must be at least 3 characters long."),
  description: z.string().min(10, "Description must be at least 10 characters long."),
  model_name: z.string().min(1, "Model name is required."),
  price_per_call_usdc: z.number().min(0.0001).max(1.00),
  max_calls: z.number().int().min(10).max(100000),
  max_input_chars: z.number().int().min(100).max(8000).default(2000),
  max_completion_tokens: z.number().int().min(50).max(2000).default(500),
  expires_at: z.string().datetime({ offset: true }),
  expiry_days: z.number().int().refine((v) => [7, 14, 30, 90].includes(v), "Expiry must be 7, 14, 30, or 90 days").optional(),
  delegation_id: z.string().min(1, "ERC-7710 delegation ID is required."),
  signed_delegation: z.record(z.string(), z.unknown()),
  encrypted_key: z.string().min(1, "Encrypted API key is required."),
  key_iv: z.string().min(1, "Encryption IV is required."),
  key_auth_tag: z.string().min(1, "Encryption auth tag is required."),
});

/**
 * Inferred type from listingSchema
 */
export type ListingInput = z.infer<typeof listingSchema>;

/**
 * Schema for granting consumer permission
 */
export const consumerPermissionSchema = z.object({
  consumer_id: z.string().regex(UUID_REGEX, "Invalid consumer ID format."),
  listing_id: z.string().regex(UUID_REGEX, "Invalid listing ID format."),
  erc7715_proof: z.string().min(1, "ERC-7715 proof is required."),
  expires_at: z.string().datetime({ offset: true }),
});

/**
 * Inferred type from consumerPermissionSchema
 */
export type ConsumerPermissionInput = z.infer<typeof consumerPermissionSchema>;

/**
 * Schema for recording a transaction
 */
export const transactionSchema = z.object({
  listing_id: z.string().regex(UUID_REGEX, "Invalid listing ID format."),
  consumer_id: z.string().regex(UUID_REGEX, "Invalid consumer ID format."),
  payment_tx_hash: z.string().min(1, "Transaction hash is required."),
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

/**
 * Schema for Gateway request validation
 */
export const gatewayRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1),
  })).min(1).max(50),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  max_tokens: z.number().int().positive().optional(),
});

/**
 * Inferred type from gatewayRequestSchema
 */
export type GatewayRequestInput = z.infer<typeof gatewayRequestSchema>;