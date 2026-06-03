-- ============================================================
-- Quotra: Decentralized P2P AI API Marketplace
-- Database Schema v2.0 — PRD-aligned
-- Run this in Supabase SQL Editor (idempotent)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Clear existing data and objects (idempotent — safe to re-run)
-- ============================================================

-- Explicitly clear all data if tables exist
DO $$ 
BEGIN 
  TRUNCATE TABLE claim_history, transactions, consumer_permissions, listings, consumers, providers CASCADE;
EXCEPTION 
  WHEN undefined_table THEN 
    -- Ignore error if tables do not exist yet
END $$;
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS claim_status CASCADE;
DROP TABLE IF EXISTS claim_history CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS consumer_permissions CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS consumers CASCADE;
DROP TABLE IF EXISTS providers CASCADE;

-- ============================================================
-- Table: providers
-- ============================================================
CREATE TABLE providers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL UNIQUE,
  pending_earnings_usdc NUMERIC(18, 8) NOT NULL DEFAULT 0,
  total_earned_usdc     NUMERIC(18, 8) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE providers IS 'AI API providers who register models';
COMMENT ON COLUMN providers.pending_earnings_usdc IS 'Accumulated earnings not yet claimed';
COMMENT ON COLUMN providers.total_earned_usdc IS 'All-time earnings (claimed + pending)';

-- ============================================================
-- Table: listings
-- ============================================================
CREATE TABLE listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           UUID REFERENCES providers(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  delegation_id         TEXT NOT NULL UNIQUE,
  signed_delegation     JSONB NOT NULL,
  encrypted_key         TEXT NOT NULL,
  key_iv                TEXT NOT NULL,
  key_auth_tag          TEXT NOT NULL,
  model_name            TEXT NOT NULL,
  price_per_call_usdc   NUMERIC(18, 8) NOT NULL,
  max_calls             INTEGER NOT NULL,
  remaining_calls       INTEGER NOT NULL,
  max_input_chars       INTEGER NOT NULL DEFAULT 2000,
  max_completion_tokens INTEGER NOT NULL DEFAULT 500,
  total_calls_made      INTEGER NOT NULL DEFAULT 0,
  expires_at            TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active',
  created_at            TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE listings IS 'Available AI API listings';
COMMENT ON COLUMN listings.delegation_id IS 'ERC-7710 delegation hash/id';
COMMENT ON COLUMN listings.signed_delegation IS 'Full signed ERC-7710 delegation object';
COMMENT ON COLUMN listings.encrypted_key IS 'AES-256-GCM ciphertext (hex)';
COMMENT ON COLUMN listings.key_iv IS 'AES initialization vector (hex, 12 bytes)';
COMMENT ON COLUMN listings.key_auth_tag IS 'AES authentication tag (hex, 16 bytes)';
COMMENT ON COLUMN listings.price_per_call_usdc IS 'Price per API call in USDC';
COMMENT ON COLUMN listings.status IS 'active | revoked | expired';

-- ============================================================
-- Table: consumers
-- ============================================================
CREATE TABLE consumers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address    TEXT NOT NULL UNIQUE,
  total_spent_usdc  NUMERIC(18, 8) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE consumers IS 'Consumers who purchase API access';
COMMENT ON COLUMN consumers.total_spent_usdc IS 'All-time USDC spent across all listings';

-- ============================================================
-- Table: consumer_permissions
-- ============================================================
CREATE TABLE consumer_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  erc7715_proof   TEXT NOT NULL,
  granted_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
);

COMMENT ON TABLE consumer_permissions IS 'ERC-7715 session permissions for consumers';
COMMENT ON COLUMN consumer_permissions.erc7715_proof IS 'Raw ERC-7715 proof from wallet_grantPermissions';
COMMENT ON COLUMN consumer_permissions.status IS 'active | revoked | expired';

-- ============================================================
-- Table: transactions
-- ============================================================
CREATE TABLE transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            UUID NOT NULL REFERENCES listings(id),
  consumer_id           UUID NOT NULL REFERENCES consumers(id),
  payment_tx_hash       TEXT NOT NULL UNIQUE,
  amount_usdc           NUMERIC(18, 8) NOT NULL,
  provider_amount_usdc  NUMERIC(18, 8) NOT NULL,
  platform_amount_usdc  NUMERIC(18, 8) NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  prompt_tokens         INTEGER,
  completion_tokens     INTEGER,
  created_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

COMMENT ON TABLE transactions IS 'Payment transaction records';
COMMENT ON COLUMN transactions.payment_tx_hash IS 'Unique blockchain tx hash — UNIQUE for replay protection';
COMMENT ON COLUMN transactions.amount_usdc IS 'Total USDC paid by consumer';
COMMENT ON COLUMN transactions.provider_amount_usdc IS '90% — credited to provider pending_earnings';
COMMENT ON COLUMN transactions.platform_amount_usdc IS '10% — stays in treasury';
COMMENT ON COLUMN transactions.status IS 'pending | completed | refund_pending | refunded';

-- ============================================================
-- Table: claim_history
-- ============================================================
CREATE TABLE claim_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES providers(id),
  amount_usdc     NUMERIC(18, 8) NOT NULL,
  tx_hash         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE claim_history IS 'Provider claim/withdrawal history';
COMMENT ON COLUMN claim_history.amount_usdc IS 'USDC amount claimed from treasury';
COMMENT ON COLUMN claim_history.status IS 'pending | completed | failed';

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_providers_wallet ON providers(wallet_address);
CREATE INDEX idx_listings_provider ON listings(provider_id);
CREATE INDEX idx_listings_status ON listings(status) WHERE status = 'active';
CREATE INDEX idx_consumers_wallet ON consumers(wallet_address);
CREATE INDEX idx_permissions_consumer ON consumer_permissions(consumer_id);
CREATE INDEX idx_permissions_listing ON consumer_permissions(listing_id);
CREATE INDEX idx_permissions_active ON consumer_permissions(status) WHERE status = 'active';
CREATE INDEX idx_transactions_listing ON transactions(listing_id);
CREATE INDEX idx_transactions_consumer ON transactions(consumer_id);
CREATE INDEX idx_transactions_tx_hash ON transactions(payment_tx_hash);
CREATE INDEX idx_claims_provider ON claim_history(provider_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_history ENABLE ROW LEVEL SECURITY;

-- Providers: read/write own data
CREATE POLICY "provider_own_record" ON providers
  FOR ALL USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Listings: public read for active + non-expired; providers manage own
CREATE POLICY "marketplace_read_active" ON listings
  FOR SELECT USING (status = 'active' AND expires_at > now());

CREATE POLICY "provider_manage_listings" ON listings
  FOR ALL USING (
    provider_id IN (
      SELECT id FROM providers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Consumers: read/write own data
CREATE POLICY "consumer_own_record" ON consumers
  FOR ALL USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Consumer Permissions: consumers read own
CREATE POLICY "consumer_read_permissions" ON consumer_permissions
  FOR SELECT USING (
    consumer_id IN (
      SELECT id FROM consumers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "consumer_create_permissions" ON consumer_permissions
  FOR INSERT WITH CHECK (
    consumer_id IN (
      SELECT id FROM consumers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Transactions: consumers read own
CREATE POLICY "consumer_read_transactions" ON transactions
  FOR SELECT USING (
    consumer_id IN (
      SELECT id FROM consumers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "consumer_create_transactions" ON transactions
  FOR INSERT WITH CHECK (
    consumer_id IN (
      SELECT id FROM consumers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Claim History: providers read own
CREATE POLICY "provider_read_claims" ON claim_history
  FOR SELECT USING (
    provider_id IN (
      SELECT id FROM providers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "provider_create_claims" ON claim_history
  FOR INSERT WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );
