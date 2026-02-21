-- Performance indexes for normalized stats/account/trade query paths

CREATE INDEX IF NOT EXISTS idx_trades_user_status_entry_date
  ON trades (user_id, status, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_trades_user_entry_date
  ON trades (user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_api_credentials_user_platform_active
  ON api_credentials (user_id, platform, is_active);

CREATE INDEX IF NOT EXISTS idx_accounts_user_active
  ON accounts (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_pending_signals_status_created_at
  ON pending_signals (status, created_at DESC);
