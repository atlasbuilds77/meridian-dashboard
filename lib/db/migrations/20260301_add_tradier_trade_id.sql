-- Add tradier_trade_id column for deduplication
ALTER TABLE trades ADD COLUMN IF NOT EXISTS tradier_trade_id TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trades_tradier_trade_id ON trades(tradier_trade_id);

-- Comment
COMMENT ON COLUMN trades.tradier_trade_id IS 'Unique trade ID from Tradier API for deduplication';
