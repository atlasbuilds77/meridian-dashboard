-- Migration: Add Tradier sync columns and monitoring table
-- Run this to enable proper Tradier gainloss sync

-- Add tradier_position_id column for deduplication
-- This is a unique ID created from account + symbol + dates
ALTER TABLE trades ADD COLUMN IF NOT EXISTS tradier_position_id VARCHAR(255) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trades_tradier_position_id ON trades(tradier_position_id);

-- Add sync_status table for monitoring
CREATE TABLE IF NOT EXISTS sync_status (
  sync_type VARCHAR(50) PRIMARY KEY,
  success BOOLEAN NOT NULL DEFAULT false,
  users_processed INTEGER DEFAULT 0,
  trades_synced INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  total_pnl DECIMAL(12, 2) DEFAULT 0,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial record for tradier sync
INSERT INTO sync_status (sync_type, success, synced_at)
VALUES ('tradier_gainloss', false, NULL)
ON CONFLICT (sync_type) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE sync_status IS 'Tracks sync job status for monitoring and alerting';
COMMENT ON COLUMN trades.tradier_position_id IS 'Unique ID from Tradier gainloss endpoint for deduplication';
