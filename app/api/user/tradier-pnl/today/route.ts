import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { getApiCredential } from '@/lib/db/api-credentials';
import { fetchTradierGainLoss } from '@/lib/api-clients/tradier-gainloss';
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
    const credential = await getApiCredential(authResult.userId, 'tradier');
    if (!credential) {
      return NextResponse.json(
        { error: 'No Tradier credentials configured' },
        { status: 404 },
      );
    }

    const accountInfo = await pool.query(
      `SELECT account_number FROM api_credentials
       WHERE user_id = $1 AND platform = 'tradier' LIMIT 1`,
      [authResult.userId],
    );

    const accountNumber = accountInfo.rows[0]?.account_number as
      | string
      | undefined;
    if (!accountNumber) {
      return NextResponse.json(
        { error: 'No Tradier account number found' },
        { status: 404 },
      );
    }

    // Get today's date in YYYY-MM-DD format (market timezone = ET, but Tradier dates are date-only)
    const today = new Date().toISOString().slice(0, 10);

    // Fetch positions closed today only
    const positions = await fetchTradierGainLoss(accountNumber, credential.api_key, {
      start: today,
      end: today,
      sortBy: 'closeDate',
      sort: 'desc',
      limit: 100,
    });

    // Filter to positions actually closed today (belt + suspenders)
    const todayPositions = positions.filter(
      (p) => p.close_date.slice(0, 10) === today,
    );

    const totalPnL = todayPositions.reduce((sum, p) => sum + p.gain_loss, 0);
    const wins = todayPositions.filter((p) => p.gain_loss > 0);
    const losses = todayPositions.filter((p) => p.gain_loss < 0);
    const winRate =
      todayPositions.length > 0
        ? (wins.length / todayPositions.length) * 100
        : 0;

    const avgWin =
      wins.length > 0
        ? wins.reduce((sum, p) => sum + p.gain_loss, 0) / wins.length
        : 0;
    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, p) => sum + p.gain_loss, 0) / losses.length
        : 0;

    // Best and worst trade today
    const bestTrade = todayPositions.length > 0
      ? todayPositions.reduce((best, p) => p.gain_loss > best.gain_loss ? p : best)
      : null;
    const worstTrade = todayPositions.length > 0
      ? todayPositions.reduce((worst, p) => p.gain_loss < worst.gain_loss ? p : worst)
      : null;

    return NextResponse.json({
      date: today,
      totalPnL,
      totalTrades: todayPositions.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      avgWin,
      avgLoss,
      bestTrade: bestTrade
        ? { symbol: bestTrade.symbol, pnl: bestTrade.gain_loss }
        : null,
      worstTrade: worstTrade
        ? { symbol: worstTrade.symbol, pnl: worstTrade.gain_loss }
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
