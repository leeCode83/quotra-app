-- ============================================================
-- Quotra: Decentralized P2P AI API Marketplace
-- Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: providers
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  encrypted_api_key TEXT,
  delegation_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE providers IS 'AI API providers who register models';
COMMENT ON COLUMN providers.encrypted_api_key IS 'AES-256-GCM encrypted API key';
COMMENT ON COLUMN providers.delegation_json IS 'ERC-7710 delegation signature data';

-- ============================================================
-- Table: listings
-- ============================================================
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  model_type TEXT NOT NULL,
  price_per_request BIGINT NOT NULL DEFAULT 0,
  endpoint_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE listings IS 'Available AI API listings';
COMMENT ON COLUMN listings.price_per_request IS 'Price in wei (smallest unit)';

-- ============================================================
-- Table: consumers
-- ============================================================
CREATE TABLE IF NOT EXISTS consumers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE consumers IS 'Consumers who purchase API access';

-- ============================================================
-- Table: consumer_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS consumer_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  permissions_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE consumer_permissions IS 'ERC-7715 session permissions for consumers';
COMMENT ON COLUMN consumer_permissions.session_key IS 'Session key for ERC-7715';
COMMENT ON COLUMN consumer_permissions.permissions_json IS 'ERC-7715 permission structure';

-- ============================================================
-- Table: transactions
-- ============================================================
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL UNIQUE,
  amount BIGINT NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE transactions IS 'Payment transaction records';
COMMENT ON COLUMN transactions.tx_hash IS 'Unique blockchain transaction hash for replay protection';

-- ============================================================
-- Table: claim_history
-- ============================================================
CREATE TYPE claim_status AS ENUM ('pending', 'claimed', 'failed');

CREATE TABLE IF NOT EXISTS claim_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  tx_hash TEXT,
  status claim_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE claim_history IS 'Provider claim/withdrawal history';
COMMENT ON COLUMN claim_history.amount IS 'Amount in wei';

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_providers_wallet ON providers(wallet_address);
CREATE INDEX idx_listings_provider ON listings(provider_id);
CREATE INDEX idx_listings_active ON listings(is_active) WHERE is_active = true;
CREATE INDEX idx_consumers_wallet ON consumers(wallet_address);
CREATE INDEX idx_permissions_consumer ON consumer_permissions(consumer_id);
CREATE INDEX idx_permissions_listing ON consumer_permissions(listing_id);
CREATE INDEX idx_permissions_expires ON consumer_permissions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_transactions_listing ON transactions(listing_id);
CREATE INDEX idx_transactions_consumer ON transactions(consumer_id);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_claims_provider ON claim_history(provider_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_history ENABLE ROW LEVEL SECURITY;

-- Providers: can read/write own data
CREATE POLICY "Providers can read own data" ON providers
  FOR SELECT USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Providers can insert own data" ON providers
  FOR INSERT WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Providers can update own data" ON providers
  FOR UPDATE USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Listings: public read for active; providers manage own
CREATE POLICY "Anyone can read active listings" ON listings
  FOR SELECT USING (is_active = true);

CREATE POLICY "Providers can manage own listings" ON listings
  FOR ALL USING (
    provider_id IN (
      SELECT id FROM providers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Consumers: read/write own data
CREATE POLICY "Consumers can read own data" ON consumers
  FOR SELECT USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Consumers can insert own data" ON consumers
  FOR INSERT WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Consumer Permissions: consumers read own
CREATE POLICY "Consumers can read own permissions" ON consumer_permissions
  FOR SELECT USING (
    consumer_id IN (
      SELECT id FROM consumers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Consumers can create permissions" ON consumer_permissions
  FOR INSERT WITH CHECK (
    consumer_id IN (
      SELECT id FROM consumers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Transactions: consumers read own
CREATE POLICY "Consumers can read own transactions" ON transactions
  FOR SELECT USING (
    consumer_id IN (
      SELECT id FROM consumers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Consumers can create transactions" ON transactions
  FOR INSERT WITH CHECK (
    consumer_id IN (
      SELECT id FROM consumers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Claim History: providers read own
CREATE POLICY "Providers can read own claims" ON claim_history
  FOR SELECT USING (
    provider_id IN (
      SELECT id FROM providers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Providers can create claims" ON claim_history
  FOR INSERT WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );
