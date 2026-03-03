import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

// Commission rate: $2.06/contract × 2 legs = $4.12/round trip
const COMMISSION_PER_ROUND_TRIP = 4.12;

function calculatePnL(trade: {
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  direction: string;
  asset_type: string;
  pnl: number | null;
}): number {
  // Use stored P&L if available
  if (trade.pnl !== null && trade.pnl !== undefined) {
    return parseFloat(String(trade.pnl)) || 0;
  }
  
  // Calculate if no stored P&L
  if (trade.exit_price === null || trade.exit_price === undefined) {
    return 0;
  }
  
  const multiplier = trade.asset_type === 'option' || trade.asset_type === 'future' ? 100 : 1;
  const directionMultiplier = ['SHORT', 'PUT'].includes(trade.direction.toUpperCase()) ? -1 : 1;
  
  return (trade.exit_price - trade.entry_price) * trade.quantity * multiplier * directionMultiplier;
}

function calculateCommission(trade: { asset_type: string; quantity: number }): number {
  // Commission applies per contract for options
  if (trade.asset_type === 'option') {
    return COMMISSION_PER_ROUND_TRIP * trade.quantity;
  }
  return 0;
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

  try {
    // Query trades for the specified week
    // Using the same source preference logic as the main trades endpoint
    const tradesResult = await pool.query(
      `WITH source_pref AS (
        SELECT EXISTS(
          SELECT 1
          FROM trades
          WHERE user_id = $1
            AND status = 'closed'
            AND tradier_position_id IS NOT NULL
        ) AS use_tradier
      ),
      filtered_trades AS (
        SELECT t.*
        FROM trades t
        CROSS JOIN source_pref sp
        WHERE t.user_id = $1
          AND t.entry_date >= $2::date
          AND t.entry_date < ($3::date + INTERVAL '1 day')
          AND t.status = 'closed'
          AND (
            (sp.use_tradier AND t.tradier_position_id IS NOT NULL)
            OR (NOT sp.use_tradier AND t.tradier_position_id IS NULL)
          )
      )
      SELECT *,
        COALESCE(
          pnl,
          CASE
            WHEN exit_price IS NULL THEN NULL
            WHEN UPPER(direction) IN ('LONG', 'CALL')
              THEN (exit_price - entry_price) * quantity * 
                   CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
            WHEN UPPER(direction) IN ('SHORT', 'PUT')
              THEN (entry_price - exit_price) * quantity * 
                   CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
            ELSE NULL
          END
        ) AS computed_pnl
       FROM filtered_trades
       ORDER BY entry_date DESC`,
      [authResult.userId, startDate, endDate]
    );

    const trades = tradesResult.rows.map((trade: any) => ({
      ...trade,
      pnl: trade.computed_pnl ?? trade.pnl,
    }));

    // Calculate weekly totals
    let grossPnL = 0;
    let totalCommissions = 0;

    for (const trade of trades) {
      const tradePnL = calculatePnL(trade);
      const tradeComm = calculateCommission(trade);
      
      grossPnL += tradePnL;
      totalCommissions += tradeComm;
    }

    const netPnL = grossPnL - totalCommissions;
    
    // Fee is 10% of net profit (only if positive)
    const feeAmount = netPnL > 0 ? netPnL * 0.10 : 0;

    return NextResponse.json({
      weekStart: startDate,
      weekEnd: endDate,
      trades,
      grossPnL,
      commissions: totalCommissions,
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
