-- Add check constraints for data integrity
-- Run this migration on your PostgreSQL database

-- Trades table constraints
ALTER TABLE trades 
  ADD CONSTRAINT check_direction 
  CHECK (direction IN ('LONG', 'SHORT', 'CALL', 'PUT'));

ALTER TABLE trades 
  ADD CONSTRAINT check_status 
  CHECK (status IN ('open', 'closed', 'stopped'));

ALTER TABLE trades 
  ADD CONSTRAINT check_asset_type 
  CHECK (asset_type IN ('stock', 'option', 'future', 'crypto'));

ALTER TABLE trades 
  ADD CONSTRAINT check_quantity_positive 
  CHECK (quantity > 0);

ALTER TABLE trades 
  ADD CONSTRAINT check_entry_price_positive 
  CHECK (entry_price > 0);

ALTER TABLE trades 
  ADD CONSTRAINT check_exit_price_positive 
  CHECK (exit_price IS NULL OR exit_price > 0);

ALTER TABLE trades 
  ADD CONSTRAINT check_exit_after_entry 
  CHECK (exit_date IS NULL OR exit_date >= entry_date);

-- Accounts table constraints
ALTER TABLE accounts 
  ADD CONSTRAINT check_balance_nonnegative 
  CHECK (balance >= 0);

ALTER TABLE accounts 
  ADD CONSTRAINT check_currency_code 
  CHECK (LENGTH(currency) = 3);

-- Add indexes for performance (if not already present)
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_date ON trades(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
