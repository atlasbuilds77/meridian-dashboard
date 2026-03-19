-- Copy-Trade Positions Table
-- Tracks each user's copy-traded positions from Oracle and NightWatch bots

CREATE TABLE IF NOT EXISTS copy_trade_positions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Source bot
    bot VARCHAR(20) NOT NULL, -- 'oracle' | 'nightwatch'
    
    -- Market identifiers
    market_id VARCHAR(255),         -- Polymarket market/condition ID
    token_id VARCHAR(255),          -- Polymarket token ID (for CLOB)
    asset VARCHAR(50),              -- 'BTC', 'ETH' for Oracle; slug for NightWatch
    question TEXT,                  -- Human-readable market question
    market_type VARCHAR(50),        -- 'crypto_5min', 'MACRO', 'ELECTION', etc.
    
    -- Trade details
    direction VARCHAR(10) NOT NULL, -- 'UP'/'DOWN' for Oracle; 'BUY'/'SELL' for NightWatch
    side VARCHAR(10) NOT NULL,      -- 'BUY' or 'SELL' (CLOB side)
    shares DECIMAL(18, 6) NOT NULL DEFAULT 0,
    entry_price DECIMAL(18, 6) NOT NULL,
    current_price DECIMAL(18, 6),
    stake_usd DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- P&L
    pnl DECIMAL(12, 4) DEFAULT 0,
    pnl_percent DECIMAL(8, 4) DEFAULT 0,
    
    -- Execution
    order_id VARCHAR(255),          -- Polymarket order ID
    execution_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending', 'submitted', 'filled', 'partial', 'failed', 'cancelled'
    error_message TEXT,
    dry_run BOOLEAN DEFAULT false,
    
    -- Source signal reference
    source_trade_id VARCHAR(255),   -- ID from Oracle trade-history or NightWatch trades table
    
    -- Resolution
    outcome VARCHAR(20),            -- 'win', 'loss', 'pending', null
    payout DECIMAL(12, 4),
    resolved_at TIMESTAMP,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'closed', 'cancelled'
    
    -- Timestamps
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ctp_user_id ON copy_trade_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_ctp_user_status ON copy_trade_positions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ctp_bot ON copy_trade_positions(bot);
CREATE INDEX IF NOT EXISTS idx_ctp_market_id ON copy_trade_positions(market_id);
CREATE INDEX IF NOT EXISTS idx_ctp_opened_at ON copy_trade_positions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctp_execution_status ON copy_trade_positions(execution_status);

-- Copy-Trade Execution Log
-- Audit trail for all copy-trade execution attempts
CREATE TABLE IF NOT EXISTS copy_trade_execution_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position_id INTEGER REFERENCES copy_trade_positions(id) ON DELETE SET NULL,
    bot VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'execute', 'retry', 'cancel', 'close', 'error'
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ctel_user_id ON copy_trade_execution_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ctel_created_at ON copy_trade_execution_log(created_at DESC);

COMMENT ON TABLE copy_trade_positions IS 'Per-user copy-traded positions from Oracle and NightWatch prediction bots.';
COMMENT ON TABLE copy_trade_execution_log IS 'Audit trail for copy-trade execution attempts.';
