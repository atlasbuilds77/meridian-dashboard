import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserStats } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

async function getUserIdFromSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('meridian_session');
  
  if (!session) {
    return null;
  }
  
  try {
    const sessionData = JSON.parse(session.value);
    
    if (sessionData.expiresAt < Date.now() || !sessionData.authorized) {
      return null;
    }
    
    return sessionData.dbUserId;
  } catch {
    return null;
  }
}

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
