import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

// Admin Discord IDs (Hunter)
const ADMIN_IDS = ['464974803462438924'];

async function requireAdmin() {
  const session = await getSession();
  if (!session || !ADMIN_IDS.includes(session.discordId)) {
    return null;
  }
  return session;
}

/**
 * GET /api/admin/users
 * List all users with trading status, credentials, and P&L
 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.discord_id,
        u.username,
        u.created_at,
        u.last_login,
        uts.trading_enabled,
        uts.size_pct,
        uts.max_position_size,
        uts.max_loss_pct,
        ac.platform,
        ac.verification_status,
        ac.account_number,
        ac.last_verified,
        COALESCE(ps.total_trades, 0) as total_trades,
        COALESCE(ps.total_pnl, 0) as total_pnl,
        COALESCE(ps.wins, 0) as wins,
        COALESCE(ps.losses, 0) as losses,
        COALESCE(ps.win_rate, 0) as win_rate,
        (SELECT MAX(t.entry_date) FROM trades t WHERE t.user_id = u.id) as last_trade
      FROM users u
      LEFT JOIN user_trading_settings uts ON u.id = uts.user_id
      LEFT JOIN api_credentials ac ON u.id = ac.user_id AND ac.platform = 'tradier'
      LEFT JOIN user_portfolio_summary ps ON u.id = ps.user_id
      ORDER BY u.created_at DESC
    `);

    // System stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN uts.trading_enabled = true THEN u.id END) as active_traders,
        COUNT(DISTINCT CASE WHEN ac.verification_status = 'verified' THEN u.id END) as verified_accounts,
        COALESCE(SUM(ps.total_pnl), 0) as platform_total_pnl,
        COALESCE(SUM(ps.total_trades), 0) as platform_total_trades
      FROM users u
      LEFT JOIN user_trading_settings uts ON u.id = uts.user_id
      LEFT JOIN api_credentials ac ON u.id = ac.user_id AND ac.platform = 'tradier'
      LEFT JOIN user_portfolio_summary ps ON u.id = ps.user_id
    `);

    return NextResponse.json({
      users: result.rows,
      stats: statsResult.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users
 * Update user trading settings (enable/disable, size_pct)
 */
export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { user_id, trading_enabled, size_pct, max_position_size } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Upsert user_trading_settings
    await pool.query(`
      INSERT INTO user_trading_settings (user_id, trading_enabled, size_pct, max_position_size, enabled_at, enabled_by)
      VALUES ($1, $2, $3, $4, 
        CASE WHEN $2 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
        CASE WHEN $2 = true THEN $5 ELSE NULL END
      )
      ON CONFLICT (user_id) DO UPDATE SET
        trading_enabled = COALESCE($2, user_trading_settings.trading_enabled),
        size_pct = COALESCE($3, user_trading_settings.size_pct),
        max_position_size = COALESCE($4, user_trading_settings.max_position_size),
        enabled_at = CASE WHEN $2 = true AND user_trading_settings.trading_enabled != true 
                     THEN CURRENT_TIMESTAMP ELSE user_trading_settings.enabled_at END,
        enabled_by = CASE WHEN $2 = true AND user_trading_settings.trading_enabled != true 
                     THEN $5 ELSE user_trading_settings.enabled_by END,
        updated_at = CURRENT_TIMESTAMP
    `, [user_id, trading_enabled, size_pct, max_position_size, session.discordId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin update error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
