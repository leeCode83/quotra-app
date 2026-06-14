-- Migration: Add task_id column to claim_history for 1Shot relayer task tracking
ALTER TABLE claim_history ADD COLUMN task_id text;
COMMENT ON COLUMN claim_history.task_id IS '1Shot relayer task ID for claim tracking via webhook';
