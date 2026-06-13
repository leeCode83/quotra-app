-- ============================================================
-- Migration: Add provider_read_transactions RLS policy
-- Allows providers to SELECT their own transactions (via listing → provider chain)
-- Fixes "No claimable amount available" bug in useProviderClaim.ts
-- ============================================================

CREATE POLICY "provider_read_transactions" ON transactions
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM listings WHERE provider_id IN (
        SELECT id FROM providers WHERE wallet_address = (auth.jwt() ->> 'wallet_address')
      )
    )
  );
