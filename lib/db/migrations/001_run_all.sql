-- Meridian Multi-Tenant Migration
-- Run on Render PostgreSQL in order:
-- 1. schema.sql (users, accounts, trades, indexes, view)
-- 2. schema-api-keys.sql (api_credentials, audit_log, onboarding)  
-- 3. schema-user-settings.sql (user_trading_settings)
-- 4. This file (add account_number column if missing)

-- Add account_number to api_credentials (may already exist if schema-api-keys.sql was updated)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_credentials' AND column_name = 'account_number'
    ) THEN
        ALTER TABLE api_credentials ADD COLUMN account_number VARCHAR(50);
    END IF;
END $$;
