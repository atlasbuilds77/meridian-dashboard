import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

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

interface TradeRow {
  id: number;
  symbol: string;
  direction: string;
  asset_type: string;
  quantity: number;
  entry_price: number | string;
  exit_price: number | string | null;
  strike: number | string | null;
  expiry: string | null;
  entry_date: string;
  exit_date: string | null;
  pnl: number | string | null;
  status: string;
  notes: string | null;
  gross_pnl: number | string | null;
  commission_amount: number | string | null;
  net_pnl: number | string | null;
}

function parseNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildTradesCte(): string {
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
        AND t.status = 'closed'
        AND (
          (sp.use_tradier AND t.tradier_position_id IS NOT NULL)
          OR (NOT sp.use_tradier AND t.tradier_position_id IS NULL)
        )
    ),
    filtered_trades AS (
      SELECT *
      FROM user_trades t
      WHERE t.trade_date BETWEEN $2::date AND $3::date
    )
  `;
}

export async function GET(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_trades_weekly',
    limit: 60,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_trades_weekly');
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end dates are required' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ error: 'Invalid date format. Expected YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const tradesCte = buildTradesCte();

    const tradesResult = await pool.query(
      `${tradesCte}
      SELECT
        t.id,
        t.symbol,
        t.direction,
        t.asset_type,
        t.quantity,
        t.entry_price,
        t.exit_price,
        t.strike,
        t.expiry,
        t.entry_date,
        t.exit_date,
        t.status,
        t.notes,
        ${GROSS_PNL_SQL} AS gross_pnl,
        ${COMMISSION_SQL} AS commission_amount,
        ${NET_PNL_SQL} AS net_pnl
      FROM filtered_trades t
      ORDER BY t.entry_date DESC`,
      [authResult.userId, startDate, endDate]
    );

    const trades = (tradesResult.rows as TradeRow[]).map((trade) => {
      const grossPnL = trade.gross_pnl === null ? null : parseNumber(trade.gross_pnl);
      const commission = parseNumber(trade.commission_amount);
      const netPnL = trade.net_pnl === null ? null : parseNumber(trade.net_pnl);

      return {
        ...trade,
        entry_price: parseNumber(trade.entry_price),
        exit_price: trade.exit_price === null ? null : parseNumber(trade.exit_price),
        strike: trade.strike === null ? null : parseNumber(trade.strike),
        gross_pnl: grossPnL,
        commission,
        net_pnl: netPnL,
        // Keep legacy field for compatibility; set to net for consistent display.
        pnl: netPnL,
      };
    });

    const grossPnL = trades.reduce((sum, trade) => sum + parseNumber(trade.gross_pnl), 0);
    const commissions = trades.reduce((sum, trade) => sum + parseNumber(trade.commission), 0);
    const netPnL = trades.reduce((sum, trade) => sum + parseNumber(trade.net_pnl), 0);

    const feeAmount = netPnL > 0 ? netPnL * 0.1 : 0;

    return NextResponse.json({
      weekStart: startDate,
      weekEnd: endDate,
      trades,
      grossPnL,
      commissions,
      netPnL,
      feeAmount,
      tradeCount: trades.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Weekly trades fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly trades' }, { status: 500 });
  }
}
