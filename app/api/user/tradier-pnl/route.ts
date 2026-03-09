import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { getApiCredential } from '@/lib/db/api-credentials';
import { fetchAllTradierGainLoss } from '@/lib/api-clients/tradier-gainloss';
import pool from '@/lib/db/pool';
import { MERIDIAN_START_DATE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/tradier-pnl
 *
 * Fetches P&L directly from Tradier's gainloss API, filtered to
 * MERIDIAN_START_DATE onwards. This is the real-time source of truth
 * for Meridian P&L — no database intermediary.
 */
export async function GET(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_tradier_pnl',
    limit: 30,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_tradier_pnl');
  }

  try {
    // Get Tradier credentials
    const credential = await getApiCredential(authResult.userId, 'tradier');
    if (!credential) {
      return NextResponse.json(
        { error: 'No Tradier credentials configured' },
        { status: 404 },
      );
    }

    // Get account number
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

    // Fetch all closed positions from Meridian start date onwards
    const positions = await fetchAllTradierGainLoss(
      accountNumber,
      credential.api_key,
      { start: MERIDIAN_START_DATE },
    );

    // Calculate totals
    const totalPnL = positions.reduce((sum, p) => sum + p.gain_loss, 0);
    const totalCost = positions.reduce((sum, p) => sum + Math.abs(p.cost), 0);
    const totalProceeds = positions.reduce((sum, p) => sum + p.proceeds, 0);

    const wins = positions.filter((p) => p.gain_loss > 0);
    const losses = positions.filter((p) => p.gain_loss < 0);

    const avgWin =
      wins.length > 0
        ? wins.reduce((sum, p) => sum + p.gain_loss, 0) / wins.length
        : 0;
    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, p) => sum + p.gain_loss, 0) / losses.length
        : 0;
    const winRate =
      positions.length > 0 ? (wins.length / positions.length) * 100 : 0;
    const profitFactor =
      avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? 999 : 0;

    // Build daily P&L for sparkline (cumulative P&L by close date)
    const dailyMap = new Map<string, number>();
    for (const p of positions) {
      const dateKey = p.close_date.slice(0, 10); // YYYY-MM-DD
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + p.gain_loss);
    }

    // Sort by date and compute cumulative
    const sortedDates = [...dailyMap.keys()].sort();
    let cumulative = 0;
    const dailyPnL = sortedDates.map((date) => {
      cumulative += dailyMap.get(date)!;
      return { date, dailyPnL: dailyMap.get(date)!, cumulativePnL: cumulative };
    });

    return NextResponse.json({
      totalPnL,
      totalCost,
      totalProceeds,
      totalTrades: positions.length,
      wins: wins.length,
      losses: losses.length,
      avgWin,
      avgLoss,
      winRate,
      profitFactor,
      dailyPnL,
      meridianStartDate: MERIDIAN_START_DATE,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Tradier P&L fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Tradier P&L' },
      { status: 500 },
    );
  }
}
