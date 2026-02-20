-- User Trading Settings Table
-- Controls whether Meridian trades for each user

CREATE TABLE IF NOT EXISTS user_trading_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Trading controls
    trading_enabled BOOLEAN DEFAULT false, -- Must explicitly enable
    size_pct DECIMAL(5, 4) DEFAULT 1.0, -- Position size (0.0-1.0, e.g., 0.25 = 25%)
    max_position_size DECIMAL(12, 2), -- Max $ per trade (optional override)
    
    -- Risk settings
    max_loss_pct DECIMAL(5, 4) DEFAULT -0.50, -- Stop loss (-0.50 = -50%)
    scale_out_enabled BOOLEAN DEFAULT true, -- Use scaling (30/50/75/100)
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enabled_at TIMESTAMP, -- When trading was last enabled
    enabled_by VARCHAR(255) -- Admin who enabled (discord_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_trading_settings_user_id ON user_trading_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trading_settings_enabled ON user_trading_settings(trading_enabled);

-- Constraints
ALTER TABLE user_trading_settings 
    ADD CONSTRAINT check_size_pct_range 
    CHECK (size_pct >= 0.0 AND size_pct <= 1.0);

ALTER TABLE user_trading_settings 
    ADD CONSTRAINT check_max_loss_negative 
    CHECK (max_loss_pct < 0);

COMMENT ON TABLE user_trading_settings IS 'Per-user Meridian trading settings and risk controls';
COMMENT ON COLUMN user_trading_settings.trading_enabled IS 'Must be explicitly enabled by admin';
COMMENT ON COLUMN user_trading_settings.size_pct IS 'Percentage of portfolio to risk per trade (0.0-1.0)';
COMMENT ON COLUMN user_trading_settings.max_position_size IS 'Optional hard cap on position size in dollars';
