import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';
import { buildCommissionSql, buildGrossPnlSql, buildNetPnlSql } from '@/lib/db/pnl-sql';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MARKET_TIMEZONE = 'America/Los_Angeles';
const NET_PNL_SQL = buildNetPnlSql('t');
const GROSS_PNL_SQL = buildGrossPnlSql('t');
const COMMISSION_SQL = buildCommissionSql('t');

interface UserTradeRow {
  id: number;
  symbol: string;
  direction: string;
  asset_type: string;
  entry_price: number | string;
  exit_price: number | string | null;
  quantity: number;
  entry_date: string;
  exit_date: string | null;
  status: string;
  setup_type: string | null;
  stop_loss: number | string | null;
  take_profit: number | string | null;
  entry_reasoning: string | null;
  strike: number | string | null;
  expiry: string | null;
  notes: string | null;
  gross_pnl: number | string | null;
  commission_amount: number | string | null;
  pnl: number | string | null;
  pnl_percent: number | string | null;
}

const USER_TRADES_CTE = `
  WITH user_trades AS (
    SELECT t.*
    FROM trades t
    WHERE t.user_id = $1
  )
`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  void request;

  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const resolvedParams = await params;
  const rawUserId = String(resolvedParams.userId || '').trim();
  if (!rawUserId) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  // Support both numeric and UUID-style IDs. Postgres will coerce numeric strings.
  const userId: number | string = /^\d+$/.test(rawUserId) ? Number.parseInt(rawUserId, 10) : rawUserId;

  try {
    // Get user info
    const userResult = await pool.query(
      `SELECT id, discord_id, username, avatar
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Get user's trades with consistent gross/commission/net values.
    const tradesResult = await pool.query(
      `${USER_TRADES_CTE}
      SELECT 
        t.id,
        t.symbol,
        t.direction,
        t.asset_type,
        t.entry_price,
        t.exit_price,
        t.quantity,
        entry_date, exit_date, status,
        setup_type, stop_loss, take_profit, entry_reasoning,
        strike, expiry, notes,
        ${GROSS_PNL_SQL} AS gross_pnl,
        ${COMMISSION_SQL} AS commission_amount,
        ${NET_PNL_SQL} AS pnl,
        COALESCE(
          t.pnl_percent,
          CASE
            WHEN t.exit_price IS NULL THEN NULL
            WHEN t.exit_price = 0 THEN NULL
            WHEN t.entry_price = 0 THEN NULL
            WHEN UPPER(t.direction) IN ('LONG', 'CALL')
              THEN ((t.exit_price - t.entry_price) / t.entry_price) * 100
            WHEN UPPER(t.direction) IN ('SHORT', 'PUT')
              THEN ((t.entry_price - t.exit_price) / t.entry_price) * 100
            ELSE NULL
          END
        ) AS pnl_percent
       FROM user_trades t
       ORDER BY entry_date DESC`,
      [userId]
    );

    // Calculate stats with net P&L.
    const statsResult = await pool.query(
      `${USER_TRADES_CTE},
      trades_with_pnl AS (
        SELECT 
          ${buildNetPnlSql('t')} AS net_pnl,
          t.exit_date
        FROM user_trades t
        WHERE t.status = 'closed'
      )
      SELECT
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE net_pnl > 0) as wins,
        COUNT(*) FILTER (WHERE net_pnl <= 0 AND net_pnl IS NOT NULL) as losses,
        COALESCE(SUM(net_pnl), 0) as total_pnl,
        COALESCE(AVG(net_pnl) FILTER (WHERE net_pnl > 0), 0) as avg_win,
        COALESCE(AVG(net_pnl) FILTER (WHERE net_pnl <= 0 AND net_pnl IS NOT NULL), 0) as avg_loss,
        COALESCE(
          SUM(net_pnl) FILTER (
            WHERE (exit_date AT TIME ZONE '${MARKET_TIMEZONE}')::date =
                  (CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date
          ),
          0
        ) as today_pnl,
        COUNT(*) FILTER (
          WHERE (exit_date AT TIME ZONE '${MARKET_TIMEZONE}')::date =
                (CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date
        ) as today_trades,
        COALESCE(
          100.0 * COUNT(*) FILTER (WHERE net_pnl > 0) / 
          NULLIF(COUNT(*) FILTER (WHERE net_pnl IS NOT NULL), 0),
          0
        ) as win_rate
      FROM trades_with_pnl`,
      [userId]
    );

    const stats = statsResult.rows[0] || {
      total_trades: 0,
      wins: 0,
      losses: 0,
      total_pnl: 0,
      avg_win: 0,
      avg_loss: 0,
      today_pnl: 0,
      today_trades: 0,
      win_rate: 0,
    };

    return NextResponse.json({
      user: {
        id: user.id,
        discord_id: user.discord_id,
        discord_username: user.username,
        discord_avatar: user.avatar,
      },
      trades: (tradesResult.rows as UserTradeRow[]).map((trade) => ({
        ...trade,
        entry_price: parseFloat(String(trade.entry_price)),
        exit_price: trade.exit_price ? parseFloat(String(trade.exit_price)) : null,
        gross_pnl:
          trade.gross_pnl === null || trade.gross_pnl === undefined
            ? null
            : parseFloat(String(trade.gross_pnl)),
        commission: parseFloat(String(trade.commission_amount || 0)),
        pnl: parseFloat(String(trade.pnl || 0)),
        net_pnl: parseFloat(String(trade.pnl || 0)),
        pnl_percent: parseFloat(String(trade.pnl_percent || 0)),
        stop_loss: trade.stop_loss ? parseFloat(String(trade.stop_loss)) : null,
        take_profit: trade.take_profit ? parseFloat(String(trade.take_profit)) : null,
        strike: trade.strike ? parseFloat(String(trade.strike)) : null,
        expiry: trade.expiry || null,
        notes: trade.notes || null,
      })),
      stats: {
        total_trades: parseInt(String(stats.total_trades), 10),
        wins: parseInt(String(stats.wins), 10),
        losses: parseInt(String(stats.losses), 10),
        total_pnl: parseFloat(String(stats.total_pnl || 0)),
        win_rate: parseFloat(String(stats.win_rate || 0)),
        avg_win: parseFloat(String(stats.avg_win || 0)),
        avg_loss: parseFloat(String(stats.avg_loss || 0)),
        today_pnl: parseFloat(String(stats.today_pnl || 0)),
        today_trades: parseInt(String(stats.today_trades || 0), 10),
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch (error: unknown) {
    console.error('User trades fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
