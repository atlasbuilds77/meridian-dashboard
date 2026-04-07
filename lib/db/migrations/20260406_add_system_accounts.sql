-- Migration: Add per-system account selection (Helios vs Meridian)
-- Date: 2026-04-06
-- Description: Replace single selected_account with per-system accounts
--              and per-system auto-execute toggles

-- Per-system SnapTrade account columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS helios_snaptrade_account TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meridian_snaptrade_account TEXT;

-- Per-system auto-execute toggles (replace single auto_execute_enabled)
ALTER TABLE users ADD COLUMN IF NOT EXISTS helios_auto_execute_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meridian_auto_execute_enabled BOOLEAN DEFAULT false;

-- Migrate existing selected account to both systems
UPDATE users
SET helios_snaptrade_account = snaptrade_selected_account,
    meridian_snaptrade_account = snaptrade_selected_account
WHERE snaptrade_selected_account IS NOT NULL;

-- Migrate existing auto_execute_enabled to both systems
UPDATE users
SET helios_auto_execute_enabled = auto_execute_enabled,
    meridian_auto_execute_enabled = auto_execute_enabled
WHERE auto_execute_enabled = true;

-- Add system column to auto_execution_log for tracking which system triggered it
ALTER TABLE auto_execution_log ADD COLUMN IF NOT EXISTS system VARCHAR(20) DEFAULT 'helios';
