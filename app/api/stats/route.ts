import { NextResponse } from 'next/server';
import fs from 'fs';

const DATA_PATH = '/Users/atlasbuilds/clawd/meridian-trader/backtest_results.json';

export async function GET() {
  try {
    const data = fs.readFileSync(DATA_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Calculate additional statistics
    const trades = parsed.trades || [];
    const summary = parsed.summary || {};
    const daily_results = parsed.daily_results || [];
    
    // Calculate streak data
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempStreak = 0;
    let lastWasWin: boolean | null = null;
    
    for (const trade of trades) {
      const isWin = trade.pnl.total_pnl > 0;
      if (lastWasWin === null || lastWasWin === isWin) {
        tempStreak++;
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
    
    // Final streak check
    if (lastWasWin !== null) {
      if (lastWasWin) {
        maxWinStreak = Math.max(maxWinStreak, tempStreak);
        currentStreak = tempStreak;
      } else {
        maxLossStreak = Math.max(maxLossStreak, tempStreak);
        currentStreak = -tempStreak;
      }
    }
    
    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    
    for (const trade of trades) {
      cumulative += trade.pnl.total_pnl;
      peak = Math.max(peak, cumulative);
      const drawdown = peak - cumulative;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    // Best and worst day
    const bestDay = daily_results.reduce((best: any, day: any) => 
      !best || day.pnl > best.pnl ? day : best, null);
    const worstDay = daily_results.reduce((worst: any, day: any) => 
      !worst || day.pnl < worst.pnl ? day : worst, null);
    
    return NextResponse.json({
      summary,
      daily_results,
      trades,
      extended_stats: {
        current_streak: currentStreak,
        max_win_streak: maxWinStreak,
        max_loss_streak: maxLossStreak,
        max_drawdown: maxDrawdown,
        best_day: bestDay,
        worst_day: worstDay,
        trading_days: daily_results.length,
        avg_trades_per_day: trades.length / Math.max(daily_results.length, 1)
      }
    });
  } catch (error) {
    console.error('Error calculating stats:', error);
    return NextResponse.json({ 
      summary: {},
      daily_results: [],
      trades: [],
      error: 'Failed to calculate stats' 
    }, { status: 500 });
  }
}
