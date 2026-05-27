// Supabase Database type placeholder — replace with generated types from your Supabase project
// Run: npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts
export type SupabaseDatabase = Record<string, never>;

export interface EscrowStats {
  totalDeposits: bigint;
  totalWithdrawals: bigint;
  lockedAmount: bigint;
}

export interface Provider {
  id: string;
  wallet_address: string;
  name: string;
  encrypted_api_key: string | null;
  delegation_json: Record<string, unknown> | null;
  created_at: string;
}

export interface Listing {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  model_type: string;
  price_per_request: number;
  endpoint_url: string;
  is_active: boolean;
  created_at: string;
}

export interface Consumer {
  id: string;
  wallet_address: string;
  name: string | null;
  created_at: string;
}

export interface ConsumerPermission {
  id: string;
  consumer_id: string;
  listing_id: string;
  session_key: string;
  permissions_json: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
}

export type TransactionStatus = "pending" | "confirmed" | "failed" | "refunded";

export interface Transaction {
  id: string;
  listing_id: string;
  consumer_id: string;
  tx_hash: string;
  amount: number;
  status: TransactionStatus;
  created_at: string;
}

export type ClaimStatus = "pending" | "claimed" | "failed";

export interface ClaimHistory {
  id: string;
  provider_id: string;
  amount: number;
  tx_hash: string | null;
  status: ClaimStatus;
  created_at: string;
}

// Extended types with relations for the UI
export interface ListingWithProvider extends Listing {
  provider: Provider | null;
}

export interface TransactionWithListing extends Transaction {
  listing: Listing | null;
}

// API Gateway types
export interface JwtPayload {
  wallet_address: string;
  consumer_id: string;
  listing_id: string;
  iat: number;
  exp: number;
}

export interface X402Payment {
  tx_hash: string;
  amount: string;
  consumer_address: string;
  listing_id: string;
  signature: string;
}

// Wallet session types
export interface WalletSession {
  address: string;
  chainId: number;
  isConnected: boolean;
}

// Provider registration form
export interface ProviderRegistrationForm {
  name: string;
  apiKey: string;
  wallet_address: string;
}

// Listing creation form
export interface ListingForm {
  name: string;
  description: string;
  model_type: string;
  price_per_request: string;
  endpoint_url: string;
}
