-- Migration: Cleanup unused columns in listings table
-- Removes signed_delegation since the app now uses EIP-7715 permissions_context
-- Removes delegation_id as it duplicates context data and the user will handle codebase updates

ALTER TABLE listings 
  DROP COLUMN IF EXISTS signed_delegation,
  DROP COLUMN IF EXISTS delegation_id;
