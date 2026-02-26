-- Add max_daily_loss column to user_trading_settings table
-- This allows setting a maximum daily loss limit per user

ALTER TABLE user_trading_settings
ADD COLUMN IF NOT EXISTS max_daily_loss DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50);

-- Add constraint for max_daily_loss (must be positive or null)
ALTER TABLE user_trading_settings
ADD CONSTRAINT check_max_daily_loss_positive 
CHECK (max_daily_loss IS NULL OR max_daily_loss > 0);

-- Add constraint for risk_level (must be one of the allowed values)
ALTER TABLE user_trading_settings
ADD CONSTRAINT check_risk_level_valid 
CHECK (risk_level IS NULL OR risk_level IN (
  'very_conservative', 
  'conservative', 
  'moderate', 
  'aggressive', 
  'maximum'
));

COMMENT ON COLUMN user_trading_settings.max_daily_loss IS 'Maximum daily loss limit in dollars (optional)';
COMMENT ON COLUMN user_trading_settings.risk_level IS 'Risk level category (derived from size_pct but can be overridden)';