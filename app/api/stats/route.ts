import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireUserId } from '@/lib/api/require-auth';

export const dynamic = 'force-dynamic';

type SummaryRow = {
  total_trades: string;
  wins: string;
  losses: string;
  win_rate: string;
  avg_win: string;
  avg_loss: string;
  total_pnl: string;
  gross_profit: string;
  gross_loss: string;
};

type DailyRow = {
  date: string;
  pnl: string;
  wins: string;
  losses: string;
  trades: string;
};

type TradeRow = {
  id: number;
  user_id: number;
  account_id: number | null;
  symbol: string;
  direction: string;
  asset_type: string;
  strike: string | null;
  expiry: string | null;
  entry_price: string;
  exit_price: string | null;
  quantity: number;
  entry_date: string;
  exit_date: string | null;
  status: string;
  notes: string | null;
  chart_url: string | null;
  created_at: string;
  updated_at: string;
  pnl_value: string | null;
};

type TradeWithPnl = TradeRow & {
  pnl: { total_pnl: number };
};

const BASE_CTE = `
  WITH normalized_trades AS (
    SELECT
      t.*,
      COALESCE(
        t.pnl,
        CASE
          WHEN t.exit_price IS NULL THEN NULL
          WHEN UPPER(t.direction) IN ('LONG', 'CALL')
            THEN (t.exit_price - t.entry_price) * t.quantity * CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
          WHEN UPPER(t.direction) IN ('SHORT', 'PUT')
            THEN (t.entry_price - t.exit_price) * t.quantity * CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
          ELSE NULL
        END
      ) AS pnl_value,
      UPPER(t.direction) AS direction_normalized
    FROM trades t
    WHERE t.user_id = $1
  ),
  closed_trades AS (
    SELECT * FROM normalized_trades WHERE status = 'closed'
  )
`;

function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number.parseFloat(String(value)) || 0;
}

function parseInteger(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number.parseInt(String(value), 10) || 0;
}

export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const summaryQuery = `${BASE_CTE}
      SELECT
        COUNT(*) AS total_trades,
        COUNT(*) FILTER (WHERE pnl_value > 0) AS wins,
        COUNT(*) FILTER (WHERE pnl_value < 0) AS losses,
        COALESCE(100.0 * COUNT(*) FILTER (WHERE pnl_value > 0) / NULLIF(COUNT(*), 0), 0) AS win_rate,
        COALESCE(AVG(pnl_value) FILTER (WHERE pnl_value > 0), 0) AS avg_win,
        COALESCE(AVG(pnl_value) FILTER (WHERE pnl_value < 0), 0) AS avg_loss,
        COALESCE(SUM(pnl_value), 0) AS total_pnl,
        COALESCE(SUM(CASE WHEN pnl_value > 0 THEN pnl_value ELSE 0 END), 0) AS gross_profit,
        ABS(COALESCE(SUM(CASE WHEN pnl_value < 0 THEN pnl_value ELSE 0 END), 0)) AS gross_loss
      FROM closed_trades
    `;

    const dailyQuery = `${BASE_CTE}
      SELECT
        DATE(entry_date)::text AS date,
        COALESCE(SUM(pnl_value), 0) AS pnl,
        COUNT(*) AS trades,
        COUNT(*) FILTER (WHERE pnl_value > 0) AS wins,
        COUNT(*) FILTER (WHERE pnl_value < 0) AS losses
      FROM closed_trades
      GROUP BY DATE(entry_date)
      ORDER BY DATE(entry_date)
    `;

    const tradesQuery = `${BASE_CTE}
      SELECT
        id,
        user_id,
        account_id,
        symbol,
        direction_normalized AS direction,
        asset_type,
        strike,
        expiry,
        entry_price,
        exit_price,
        quantity,
        entry_date,
        exit_date,
        status,
        notes,
        chart_url,
        created_at,
        updated_at,
        pnl_value
      FROM normalized_trades
      ORDER BY entry_date ASC
    `;

    const [summaryResult, dailyResult, tradesResult] = await Promise.all([
      pool.query<SummaryRow>(summaryQuery, [authResult.userId]),
      pool.query<DailyRow>(dailyQuery, [authResult.userId]),
      pool.query<TradeRow>(tradesQuery, [authResult.userId]),
    ]);

    const summaryRow = summaryResult.rows[0] || {
      total_trades: '0',
      wins: '0',
      losses: '0',
      win_rate: '0',
      avg_win: '0',
      avg_loss: '0',
      total_pnl: '0',
      gross_profit: '0',
      gross_loss: '0',
    };

    const grossProfit = parseNumber(summaryRow.gross_profit);
    const grossLoss = parseNumber(summaryRow.gross_loss);

    const summary = {
      total_trades: parseInteger(summaryRow.total_trades),
      wins: parseInteger(summaryRow.wins),
      losses: parseInteger(summaryRow.losses),
      win_rate: parseNumber(summaryRow.win_rate),
      avg_win: parseNumber(summaryRow.avg_win),
      avg_loss: parseNumber(summaryRow.avg_loss),
      profit_factor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
      total_pnl: parseNumber(summaryRow.total_pnl),
      total_return_pct: 0,
    };

    const dailyResults = dailyResult.rows.map((row) => ({
      date: row.date,
      pnl: parseNumber(row.pnl),
      wins: parseInteger(row.wins),
      losses: parseInteger(row.losses),
      trades: parseInteger(row.trades),
    }));

    const tradesWithPnl: TradeWithPnl[] = tradesResult.rows.map((trade) => ({
      ...trade,
      direction: trade.direction.toUpperCase(),
      pnl: {
        total_pnl: parseNumber(trade.pnl_value),
      },
    }));

    const closedTrades = tradesWithPnl.filter((trade) => trade.status === 'closed');

    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempStreak = 0;
    let lastWasWin: boolean | null = null;

    for (const trade of closedTrades) {
      const isWin = trade.pnl.total_pnl > 0;
      if (lastWasWin === null || lastWasWin === isWin) {
        tempStreak += 1;
      } else {
        if (lastWasWin) {
          maxWinStreak = Math.max(maxWinStreak, tempStreak);
        } else {
          maxLossStreak = Math.max(maxLossStreak, tempStreak);
        }
        tempStreak = 1;
      }
      lastWasWin = isWin;
    }

    if (lastWasWin !== null) {
      if (lastWasWin) {
        maxWinStreak = Math.max(maxWinStreak, tempStreak);
        currentStreak = tempStreak;
      } else {
        maxLossStreak = Math.max(maxLossStreak, tempStreak);
        currentStreak = -tempStreak;
      }
    }

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const trade of closedTrades) {
      cumulative += trade.pnl.total_pnl;
      peak = Math.max(peak, cumulative);
      maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    }

    const bestDay =
      dailyResults.length > 0
        ? dailyResults.reduce((best, day) => (day.pnl > best.pnl ? day : best), dailyResults[0])
        : null;

    const worstDay =
      dailyResults.length > 0
        ? dailyResults.reduce((worst, day) => (day.pnl < worst.pnl ? day : worst), dailyResults[0])
        : null;

    return NextResponse.json({
      summary,
      daily_results: dailyResults,
      trades: tradesWithPnl,
      extended_stats: {
        current_streak: currentStreak,
        max_win_streak: maxWinStreak,
        max_loss_streak: maxLossStreak,
        max_drawdown: maxDrawdown,
        best_day: bestDay,
        worst_day: worstDay,
        trading_days: dailyResults.length,
        avg_trades_per_day:
          dailyResults.length > 0 ? closedTrades.length / dailyResults.length : 0,
      },
    });
  } catch (error) {
    console.error('Error calculating stats:', error);
    return NextResponse.json(
      {
        summary: {
          total_trades: 0,
          wins: 0,
          losses: 0,
          win_rate: 0,
          avg_win: 0,
          avg_loss: 0,
          profit_factor: 0,
          total_pnl: 0,
          total_return_pct: 0,
        },
        daily_results: [],
        trades: [],
        extended_stats: {
          current_streak: 0,
          max_win_streak: 0,
          max_loss_streak: 0,
          max_drawdown: 0,
          best_day: null,
          worst_day: null,
          trading_days: 0,
          avg_trades_per_day: 0,
        },
        error: 'Failed to calculate stats',
      },
      { status: 500 }
    );
  }
}
