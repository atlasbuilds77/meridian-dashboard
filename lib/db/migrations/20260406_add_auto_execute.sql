-- Migration: Add auto-execute support
-- Date: 2026-04-06
-- Description: Adds auto_execute_enabled flag to users table and audit log table

-- Add auto_execute_enabled column to users (default false = opt-in only)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_execute_enabled BOOLEAN DEFAULT false;

-- Audit trail for all auto-executions triggered by Helios webhook
CREATE TABLE IF NOT EXISTS auto_execution_log (
    id SERIAL PRIMARY KEY,
    signal_id VARCHAR(255) NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    action VARCHAR(10) NOT NULL,       -- 'buy' or 'sell'
    contract_symbol VARCHAR(100),       -- OCC option symbol if applicable
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(255),
    status VARCHAR(50) NOT NULL,        -- 'success', 'error', 'no_eligible_users'
    details TEXT,                        -- JSON with order details or error message
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auto_exec_log_signal ON auto_execution_log(signal_id);
CREATE INDEX IF NOT EXISTS idx_auto_exec_log_user ON auto_execution_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_exec_log_created ON auto_execution_log(created_at DESC);
