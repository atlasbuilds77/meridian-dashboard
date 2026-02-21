import { NextResponse } from 'next/server';
import { getUserStats } from '@/lib/db/users';
import { requireUserId } from '@/lib/api/require-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const stats = await getUserStats(authResult.userId);

    return NextResponse.json({
      totalAccounts: Number.parseInt(String(stats.total_accounts || 0), 10) || 0,
      totalBalance: Number.parseFloat(String(stats.total_balance || 0)) || 0,
      totalTrades: Number.parseInt(String(stats.total_trades || 0), 10) || 0,
      wins: Number.parseInt(String(stats.wins || 0), 10) || 0,
      losses: Number.parseInt(String(stats.losses || 0), 10) || 0,
      totalPnL: Number.parseFloat(String(stats.total_pnl || 0)) || 0,
      winRate: Number.parseFloat(String(stats.win_rate || 0)) || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
