-- MERIDIAN BILLING SYSTEM
-- Database: meridian_0j0f
-- Created: 2026-02-20
-- Purpose: Performance fee billing (10% of weekly profits)

-- ============================================================================
-- 1. BILLING PERIODS
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_periods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_pnl DECIMAL(10,2) NOT NULL,
  fee_amount DECIMAL(10,2) NOT NULL,
  fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'waived')),
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, week_start, week_end)
);

CREATE INDEX idx_billing_periods_user ON billing_periods(user_id);
CREATE INDEX idx_billing_periods_status ON billing_periods(status);
CREATE INDEX idx_billing_periods_week ON billing_periods(week_start, week_end);

-- ============================================================================
-- 2. PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  billing_period_id INTEGER REFERENCES billing_periods(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  payment_method_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  failure_reason TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_period ON payments(billing_period_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id);

-- ============================================================================
-- 3. PAYMENT METHODS (Stripe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_payment_methods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT UNIQUE,
  payment_method_type TEXT NOT NULL, -- 'card', 'bank_account', etc.
  card_brand TEXT, -- 'visa', 'mastercard', etc.
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  billing_email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_methods_user ON user_payment_methods(user_id);
CREATE INDEX idx_payment_methods_customer ON user_payment_methods(stripe_customer_id);
CREATE UNIQUE INDEX idx_one_default_per_user ON user_payment_methods(user_id) WHERE is_default = true;

-- ============================================================================
-- 4. BILLING EVENTS LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  billing_period_id INTEGER REFERENCES billing_periods(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'period_created',
    'charge_attempted',
    'charge_succeeded',
    'charge_failed',
    'refund_issued',
    'payment_method_added',
    'payment_method_removed',
    'billing_enabled',
    'billing_disabled'
  )),
  event_data JSONB,
  stripe_event_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_events_user ON billing_events(user_id);
CREATE INDEX idx_billing_events_period ON billing_events(billing_period_id);
CREATE INDEX idx_billing_events_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_timestamp ON billing_events(created_at);

-- ============================================================================
-- 5. ADD BILLING FLAGS TO USERS TABLE
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_billing ON users(billing_enabled) WHERE billing_enabled = true;
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get user's default payment method
CREATE OR REPLACE FUNCTION get_default_payment_method(p_user_id INTEGER)
RETURNS TABLE (
  payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT upm.stripe_payment_method_id, upm.card_brand, upm.card_last4
  FROM user_payment_methods upm
  WHERE upm.user_id = p_user_id AND upm.is_default = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate weekly P&L for user
CREATE OR REPLACE FUNCTION calculate_weekly_pnl(
  p_user_id INTEGER,
  p_week_start DATE,
  p_week_end DATE
)
RETURNS TABLE (
  total_pnl DECIMAL,
  trade_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.pnl), 0) as total_pnl,
    COUNT(*)::INTEGER as trade_count
  FROM trades t
  WHERE t.user_id = p_user_id
    AND t.entry_date >= p_week_start
    AND t.entry_date <= p_week_end
    AND t.status = 'closed'
    AND t.pnl IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Get unpaid billing periods
CREATE OR REPLACE FUNCTION get_unpaid_periods(p_user_id INTEGER)
RETURNS TABLE (
  period_id INTEGER,
  week_start DATE,
  week_end DATE,
  fee_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT bp.id, bp.week_start, bp.week_end, bp.fee_amount
  FROM billing_periods bp
  WHERE bp.user_id = p_user_id
    AND bp.status IN ('pending', 'failed')
  ORDER BY bp.week_start DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA RETENTION
-- ============================================================================

COMMENT ON TABLE billing_periods IS 'Retain for 7 years per IRS requirements';
COMMENT ON TABLE payments IS 'Retain for 7 years per IRS requirements';
COMMENT ON TABLE billing_events IS 'Retain for 7 years for audit trail';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON billing_periods TO meridian_user;
GRANT SELECT, INSERT, UPDATE ON payments TO meridian_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_payment_methods TO meridian_user;
GRANT SELECT, INSERT ON billing_events TO meridian_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO meridian_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO meridian_user;
