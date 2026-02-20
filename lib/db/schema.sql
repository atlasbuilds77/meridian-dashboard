-- Multi-tenant Meridian Dashboard Schema
-- Each user (Discord ID) has their own isolated data

-- Users table (Discord auth)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    discriminator VARCHAR(10),
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User trading accounts
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL, -- 'Tradier', 'Webull', 'TopstepX', etc.
    account_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255),
    balance DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform, account_id)
);

-- User trades (manual entry initially, auto-sync later)
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'LONG', 'SHORT', 'CALL', 'PUT'
    asset_type VARCHAR(20) DEFAULT 'stock', -- 'stock', 'option', 'future', 'crypto'
    strike DECIMAL(10, 2),
    expiry DATE,
    entry_price DECIMAL(12, 4) NOT NULL,
    exit_price DECIMAL(12, 4),
    quantity INTEGER NOT NULL DEFAULT 1,
    entry_date TIMESTAMP NOT NULL,
    exit_date TIMESTAMP,
    pnl DECIMAL(12, 2),
    pnl_percent DECIMAL(8, 2),
    status VARCHAR(20) DEFAULT 'closed', -- 'open', 'closed', 'stopped'
    notes TEXT,
    chart_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_date ON trades(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- View: User portfolio summary
CREATE OR REPLACE VIEW user_portfolio_summary AS
SELECT 
    u.id as user_id,
    u.discord_id,
    u.username,
    COUNT(DISTINCT a.id) as total_accounts,
    COALESCE(SUM(a.balance), 0) as total_balance,
    COUNT(t.id) as total_trades,
    COUNT(CASE WHEN t.pnl > 0 THEN 1 END) as wins,
    COUNT(CASE WHEN t.pnl < 0 THEN 1 END) as losses,
    COALESCE(SUM(t.pnl), 0) as total_pnl,
    CASE 
        WHEN COUNT(t.id) > 0 
        THEN ROUND((COUNT(CASE WHEN t.pnl > 0 THEN 1 END)::DECIMAL / COUNT(t.id)::DECIMAL) * 100, 2)
        ELSE 0 
    END as win_rate
FROM users u
LEFT JOIN accounts a ON u.id = a.user_id AND a.is_active = true
LEFT JOIN trades t ON u.id = t.user_id AND t.status = 'closed'
GROUP BY u.id, u.discord_id, u.username;
