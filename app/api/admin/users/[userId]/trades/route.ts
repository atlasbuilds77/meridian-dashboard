import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MARKET_TIMEZONE = 'America/Los_Angeles';

const COMMISSION_SQL = `
  COALESCE(
    t.commission,
    CASE
      WHEN (to_jsonb(t) ->> 'commission') ~ '^-?\\d+(\\.\\d+)?$'
        THEN (to_jsonb(t) ->> 'commission')::numeric
      WHEN (to_jsonb(t) ->> 'commissions') ~ '^-?\\d+(\\.\\d+)?$'
        THEN (to_jsonb(t) ->> 'commissions')::numeric
      ELSE NULL
    END,
    0
  )`;

const GROSS_PNL_SQL = `
  COALESCE(
    CASE
      WHEN (to_jsonb(t) ->> 'gross_pnl') ~ '^-?\\d+(\\.\\d+)?$'
        THEN (to_jsonb(t) ->> 'gross_pnl')::numeric
      ELSE NULL
    END,
    t.pnl,
    CASE
      WHEN t.net_pnl IS NOT NULL THEN t.net_pnl + (${COMMISSION_SQL})
      ELSE NULL
    END,
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
  )`;

const NET_PNL_SQL = `
  COALESCE(
    t.net_pnl,
    CASE
      WHEN t.pnl IS NOT NULL THEN t.pnl - (${COMMISSION_SQL})
      ELSE NULL
    END,
    CASE
      WHEN (${GROSS_PNL_SQL}) IS NULL THEN NULL
      ELSE (${GROSS_PNL_SQL}) - (${COMMISSION_SQL})
    END
  )`;

function getDateCondition(period: string): string {
  switch (period) {
    case 'today':
      return `AND t.trade_date = (CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date`;
    case 'week':
      return `AND t.trade_date >= ((CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date - INTERVAL '7 days')`;
    case 'month':
      return `AND t.trade_date >= ((CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date - INTERVAL '30 days')`;
    case 'all':
    default:
      return '';
  }
}

function buildTradesCte(dateCondition = ''): string {
  return `
    WITH source_pref AS (
      SELECT EXISTS(
        SELECT 1
        FROM trades
        WHERE user_id = $1
          AND status = 'closed'
          AND tradier_position_id IS NOT NULL
      ) AS use_tradier
    ),
    user_trades AS (
      SELECT
        t.*,
        COALESCE(
          (t.exit_date AT TIME ZONE '${MARKET_TIMEZONE}')::date,
          (t.entry_date AT TIME ZONE '${MARKET_TIMEZONE}')::date,
          (t.created_at AT TIME ZONE '${MARKET_TIMEZONE}')::date
        ) AS trade_date
      FROM trades t
      CROSS JOIN source_pref sp
      WHERE t.user_id = $1
        AND (
          t.status <> 'closed'
          OR (sp.use_tradier AND t.tradier_position_id IS NOT NULL)
          OR (NOT sp.use_tradier AND t.tradier_position_id IS NULL)
        )
    ),
    filtered_trades AS (
      SELECT *
      FROM user_trades t
      WHERE 1=1
      ${dateCondition}
    )
  `;
}

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
  net_pnl: number | string | null;
  pnl_percent: number | string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const resolvedParams = await params;
  const rawUserId = String(resolvedParams.userId || '').trim();
  if (!rawUserId) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const userId: number | string = /^\d+$/.test(rawUserId) ? Number.parseInt(rawUserId, 10) : rawUserId;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'all';
  const dateCondition = getDateCondition(period);
  const TRADES_CTE = buildTradesCte(dateCondition);

  try {
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

    const tradesResult = await pool.query(
      `${TRADES_CTE}
      SELECT
        t.id,
        t.symbol,
        t.direction,
        t.asset_type,
        t.entry_price,
        t.exit_price,
        t.quantity,
        t.entry_date,
        t.exit_date,
        t.status,
        t.setup_type,
        t.stop_loss,
        t.take_profit,
        t.entry_reasoning,
        t.strike,
        t.expiry,
        t.notes,
        ${GROSS_PNL_SQL} AS gross_pnl,
        ${COMMISSION_SQL} AS commission_amount,
        ${NET_PNL_SQL} AS net_pnl,
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
      FROM filtered_trades t
      ORDER BY t.entry_date DESC`,
      [userId]
    );

    const statsResult = await pool.query(
      `${TRADES_CTE},
      period_closed AS (
        SELECT ${NET_PNL_SQL} AS net_pnl
        FROM filtered_trades t
        WHERE t.status = 'closed'
      ),
      today_closed AS (
        SELECT ${NET_PNL_SQL} AS net_pnl
        FROM user_trades t
        WHERE t.status = 'closed'
          AND t.trade_date = (CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date
      )
      SELECT
        (SELECT COUNT(*) FROM period_closed)::INTEGER AS total_trades,
        (SELECT COUNT(*) FROM period_closed WHERE net_pnl > 0)::INTEGER AS wins,
        (SELECT COUNT(*) FROM period_closed WHERE net_pnl <= 0 AND net_pnl IS NOT NULL)::INTEGER AS losses,
        COALESCE((SELECT SUM(net_pnl) FROM period_closed), 0) AS total_pnl,
        COALESCE((SELECT AVG(net_pnl) FROM period_closed WHERE net_pnl > 0), 0) AS avg_win,
        COALESCE((SELECT AVG(net_pnl) FROM period_closed WHERE net_pnl <= 0 AND net_pnl IS NOT NULL), 0) AS avg_loss,
        COALESCE((SELECT SUM(net_pnl) FROM today_closed), 0) AS today_pnl,
        (SELECT COUNT(*) FROM today_closed)::INTEGER AS today_trades,
        COALESCE(
          100.0 *
          (SELECT COUNT(*) FROM period_closed WHERE net_pnl > 0) /
          NULLIF((SELECT COUNT(*) FROM period_closed WHERE net_pnl IS NOT NULL), 0),
          0
        ) AS win_rate`,
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

    return NextResponse.json(
      {
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
          net_pnl: parseFloat(String(trade.net_pnl || 0)),
          pnl: parseFloat(String(trade.net_pnl || 0)),
          pnl_percent: parseFloat(String(trade.pnl_percent || 0)),
          stop_loss: trade.stop_loss ? parseFloat(String(trade.stop_loss)) : null,
          take_profit: trade.take_profit ? parseFloat(String(trade.take_profit)) : null,
          strike: trade.strike ? parseFloat(String(trade.strike)) : null,
          expiry: trade.expiry || null,
          notes: trade.notes || null,
        })),
        stats: {
          total_trades: parseInt(String(stats.total_trades || 0), 10),
          wins: parseInt(String(stats.wins || 0), 10),
          losses: parseInt(String(stats.losses || 0), 10),
          total_pnl: parseFloat(String(stats.total_pnl || 0)),
          win_rate: parseFloat(String(stats.win_rate || 0)),
          avg_win: parseFloat(String(stats.avg_win || 0)),
          avg_loss: parseFloat(String(stats.avg_loss || 0)),
          today_pnl: parseFloat(String(stats.today_pnl || 0)),
          today_trades: parseInt(String(stats.today_trades || 0), 10),
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error: unknown) {
    console.error('User trades fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
