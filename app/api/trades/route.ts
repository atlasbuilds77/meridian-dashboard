import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500); // FIXED: Capped

  try {
    // Get recent signals/trades from Helios pending_signals table
    const result = await pool.query(`
      SELECT 
        symbol,
        direction,
        strike,
        expiry,
        entry_price,
        confidence,
        reasoning,
        status,
        chart_url,
        created_at,
        reviewed_at,
        approved_at
      FROM pending_signals
      WHERE status IN ('approved', 'rejected', 'executed')
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    const trades = result.rows;

    // Calculate summary statistics
    const approvedTrades = trades.filter(t => t.status === 'approved' || t.status === 'executed');
    const totalTrades = approvedTrades.length;
    
    // Mock P&L calculations (in real system, you'd track actual exits)
    // For now, use confidence as a proxy
    const wins = approvedTrades.filter(t => t.confidence >= 80).length;
    const losses = totalTrades - wins;
    const avgWin = 250; // Mock average win
    const avgLoss = -150; // Mock average loss
    const totalPnL = (wins * avgWin) + (losses * avgLoss);
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = losses > 0 ? Math.abs((wins * avgWin) / (losses * avgLoss)) : wins > 0 ? Infinity : 0;

    return NextResponse.json({
      trades: trades.map(t => ({
        symbol: t.symbol,
        direction: t.direction,
        strike: parseFloat(t.strike),
        expiry: t.expiry,
        entryPrice: parseFloat(t.entry_price),
        confidence: parseInt(t.confidence),
        reasoning: t.reasoning,
        status: t.status,
        chartUrl: t.chart_url,
        createdAt: t.created_at,
        reviewedAt: t.reviewed_at,
        approvedAt: t.approved_at,
        // Mock P&L for display
        pnl: t.confidence >= 80 ? avgWin : avgLoss,
        exitPrice: t.confidence >= 80 ? parseFloat(t.entry_price) * 1.15 : parseFloat(t.entry_price) * 0.95
      })),
      summary: {
        totalTrades,
        wins,
        losses,
        totalPnL,
        avgWin,
        avgLoss,
        winRate,
        profitFactor
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database error:', error);
    
    // Return empty data if database fails
    return NextResponse.json({
      trades: [],
      summary: {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        winRate: 0,
        profitFactor: 0
      },
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    }, { status: 500 });
  }
}
