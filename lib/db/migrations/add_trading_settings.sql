-- Add trading settings to api_credentials table
-- These control whether Meridian executes trades for this user

ALTER TABLE api_credentials 
ADD COLUMN IF NOT EXISTS trading_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS size_pct INTEGER DEFAULT 100 CHECK (size_pct >= 1 AND size_pct <= 100);

COMMENT ON COLUMN api_credentials.trading_enabled IS 'Whether Meridian should execute trades for this user';
COMMENT ON COLUMN api_credentials.size_pct IS 'Position size percentage (1-100%)';
