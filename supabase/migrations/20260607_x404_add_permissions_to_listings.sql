-- Add permissions_context and delegation_manager to listings table
-- Also make signed_delegation optional because EIP-7715 uses permissions_context instead

ALTER TABLE listings 
ADD COLUMN permissions_context JSONB,
ADD COLUMN delegation_manager TEXT,
ALTER COLUMN signed_delegation DROP NOT NULL;
