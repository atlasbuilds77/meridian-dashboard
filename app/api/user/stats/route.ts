import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import { getUserStats } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const stats = await getUserStats(userId);
    
    return NextResponse.json({
      totalAccounts: parseInt(stats.total_accounts) || 0,
      totalBalance: parseFloat(stats.total_balance) || 0,
      totalTrades: parseInt(stats.total_trades) || 0,
      wins: parseInt(stats.wins) || 0,
      losses: parseInt(stats.losses) || 0,
      totalPnL: parseFloat(stats.total_pnl) || 0,
      winRate: parseFloat(stats.win_rate) || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
