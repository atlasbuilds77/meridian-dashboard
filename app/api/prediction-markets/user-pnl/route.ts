import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import {
  getUserPositions,
  getUserPnLSummary,
} from '@/lib/db/copy-trade-positions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'prediction_markets_user_pnl',
    limit: 60,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'prediction_markets_user_pnl');
  }

  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as 'open' | 'closed' | 'all' | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const [positions, summary] = await Promise.all([
      getUserPositions(authResult.userId, {
        status: statusFilter || 'all',
        limit: Math.min(limit, 100),
      }),
      getUserPnLSummary(authResult.userId),
    ]);

    return NextResponse.json({
      positions: positions.map((p) => ({
        id: p.id,
        bot: p.bot,
        asset: p.asset,
        question: p.question,
        marketType: p.market_type,
        direction: p.direction,
        side: p.side,
        shares: parseFloat(String(p.shares)),
        entryPrice: parseFloat(String(p.entry_price)),
        currentPrice: p.current_price ? parseFloat(String(p.current_price)) : null,
        stakeUsd: parseFloat(String(p.stake_usd)),
        pnl: parseFloat(String(p.pnl)),
        pnlPercent: parseFloat(String(p.pnl_percent)),
        executionStatus: p.execution_status,
        dryRun: p.dry_run,
        outcome: p.outcome,
        payout: p.payout ? parseFloat(String(p.payout)) : null,
        status: p.status,
        openedAt: p.opened_at,
        closedAt: p.closed_at,
      })),
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[UserPnL] Failed to fetch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user P&L data' },
      { status: 500 }
    );
  }
}
