-- Fix PnL calculation in user_portfolio_summary view
-- Uses fallback calculation when trades.pnl is NULL but exit_price exists
-- Matches logic in app/api/admin/users/route.ts

CREATE OR REPLACE VIEW user_portfolio_summary AS
WITH trade_pnl AS (
    SELECT
        t.user_id,
        t.id,
        COALESCE(
            t.pnl,
            CASE
                WHEN t.exit_price IS NULL THEN NULL
                WHEN UPPER(t.direction) IN ('LONG', 'CALL')
                    THEN (t.exit_price - t.entry_price) * t.quantity * 
                         CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
                WHEN UPPER(t.direction) IN ('SHORT', 'PUT')
                    THEN (t.entry_price - t.exit_price) * t.quantity * 
                         CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
                ELSE NULL
            END
        ) AS pnl_value
    FROM trades t
    WHERE t.status = 'closed'
)
SELECT 
    u.id as user_id,
    u.discord_id,
    u.username,
    COUNT(DISTINCT a.id) as total_accounts,
    COALESCE(SUM(a.balance), 0) as total_balance,
    COUNT(tp.id) as total_trades,
    COUNT(CASE WHEN tp.pnl_value > 0 THEN 1 END) as wins,
    COUNT(CASE WHEN tp.pnl_value < 0 THEN 1 END) as losses,
    COALESCE(SUM(tp.pnl_value), 0) as total_pnl,
    CASE 
        WHEN COUNT(tp.id) > 0 
        THEN ROUND((COUNT(CASE WHEN tp.pnl_value > 0 THEN 1 END)::DECIMAL / COUNT(tp.id)::DECIMAL) * 100, 2)
        ELSE 0 
    END as win_rate
FROM users u
LEFT JOIN accounts a ON u.id = a.user_id AND a.is_active = true
LEFT JOIN trade_pnl tp ON u.id = tp.user_id
GROUP BY u.id, u.discord_id, u.username;
