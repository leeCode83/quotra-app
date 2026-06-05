export type SupabaseDatabase = Record<string, never>;

export interface EscrowStats {
  totalDeposits: bigint;
  totalWithdrawals: bigint;
  lockedAmount: bigint;
}

export interface Provider {
  id: string;
  name?: string;
  wallet_address: string;
  pending_earnings_usdc: string | null;
  total_earned_usdc: string | null;
  encrypted_api_key: string | null;
  delegation_json: Record<string, unknown> | null;
  created_at: string;
}

export interface Listing {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  model_name: string;
  price_per_call_usdc: string;
  max_calls: number;
  remaining_calls: number;
  max_input_chars: number;
  max_completion_tokens: number;
  status: string;
  expires_at: string;
  delegation_id: string | null;
  signed_delegation: Record<string, unknown> | null;
  encrypted_key: string | null;
  key_iv: string | null;
  key_auth_tag: string | null;
  endpoint_url: string | null;
  created_at: string;
}

export type TransactionStatus = "pending" | "completed" | "confirmed" | "failed" | "refunded";

export interface Transaction {
  id: string;
  listing_id: string;
  consumer_id?: string;
  payment_tx_hash?: string;
  amount_usdc: string;
  provider_amount_usdc: string;
  platform_amount_usdc: string;
  status: TransactionStatus;
  prompt_tokens?: number;
  completion_tokens?: number;
  created_at: string;
  completed_at?: string;
  updated_at?: string;
}

export type ClaimStatus = "pending" | "claimed" | "failed";

export interface ClaimHistory {
  id: string;
  provider_id: string;
  amount_usdc: number;
  tx_hash: string | null;
  status: ClaimStatus;
  created_at: string;
  updated_at?: string;
}

export interface ListingWithProvider extends Listing {
  provider: Provider | null;
}

export interface TransactionWithListing extends Transaction {
  listing: Listing | null;
}

export interface X402Payment {
  tx_hash: string;
  amount: string;
  consumer_address: string;
  listing_id: string;
  signature: string;
}

export interface WalletSession {
  address: string;
  chainId: number;
  isConnected: boolean;
}

export interface ProviderRegistrationForm {
  name: string;
}

export interface ListingForm {
  name: string;
  description: string;
  model_name: string;
  price_per_call_usdc: string;
  max_calls: number;
  max_input_chars: number;
  max_completion_tokens: number;
  expires_at: string;
  api_key: string;
}
