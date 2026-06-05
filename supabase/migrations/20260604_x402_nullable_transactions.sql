-- Migration: Make consumer_id and payment_tx_hash nullable in transactions
-- x402 handles payment verification externally — these fields are optional
-- for usage-tracking records created after AI call completion.

ALTER TABLE transactions
  ALTER COLUMN consumer_id DROP NOT NULL,
  ALTER COLUMN payment_tx_hash DROP NOT NULL;

COMMENT ON COLUMN transactions.consumer_id IS 'Nullable — x402 flow does not require a consumer DB record';
COMMENT ON COLUMN transactions.payment_tx_hash IS 'Nullable — x402 facilitator handles payment settlement externally';
