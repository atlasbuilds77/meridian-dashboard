import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/tradier-pnl/today
 *
 * Fetches TODAY-ONLY P&L from Tradier's gainloss API.
 * Filters to positions closed today (close_date = CURRENT_DATE).
 * Used by the Today's P&L Hero Card.
 */
export async function GET(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_tradier_pnl_today',
    limit: 60,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_tradier_pnl_today');
  }

  try {
    // Query trades from database using ET timezone for "today"
    // This is more reliable than Tradier API which can have delays
    const result = await pool.query(
      `SELECT 
        id, symbol, direction, pnl, exit_date
      FROM trades 
      WHERE user_id = $1 
        AND exit_date IS NOT NULL
        AND (exit_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date = 
            (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
      ORDER BY exit_date DESC`,
      [authResult.userId]
    );

    const todayTrades = result.rows;

    // Get today's date in ET for response
    const etFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = etFormatter.format(new Date());

    const totalPnL = todayTrades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    const wins = todayTrades.filter((t) => parseFloat(t.pnl) > 0);
    const losses = todayTrades.filter((t) => parseFloat(t.pnl) < 0);
    const winRate =
      todayTrades.length > 0
        ? (wins.length / todayTrades.length) * 100
        : 0;

    const avgWin =
      wins.length > 0
        ? wins.reduce((sum, t) => sum + parseFloat(t.pnl), 0) / wins.length
        : 0;
    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, t) => sum + parseFloat(t.pnl), 0) / losses.length
        : 0;

    // Best and worst trade today
    const bestTrade = todayTrades.length > 0
      ? todayTrades.reduce((best, t) => parseFloat(t.pnl) > parseFloat(best.pnl) ? t : best)
      : null;
    const worstTrade = todayTrades.length > 0
      ? todayTrades.reduce((worst, t) => parseFloat(t.pnl) < parseFloat(worst.pnl) ? t : worst)
      : null;

    return NextResponse.json({
      date: today,
      totalPnL,
      totalTrades: todayTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      avgWin,
      avgLoss,
      bestTrade: bestTrade
        ? { symbol: bestTrade.symbol, pnl: parseFloat(bestTrade.pnl) }
        : null,
      worstTrade: worstTrade
        ? { symbol: worstTrade.symbol, pnl: parseFloat(worstTrade.pnl) }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Today P&L fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch today P&L' },
      { status: 500 },
    );
  }
}
