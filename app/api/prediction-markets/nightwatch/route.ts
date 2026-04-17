import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({ request, name: 'prediction_markets_nightwatch', limit: 60, windowMs: 60_000 });
  if (!limiterResult.allowed) return rateLimitExceededResponse(limiterResult, 'prediction_markets_nightwatch');
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  try {
    const client = await pool.connect();
    try {
      const { rows: trades } = await client.query(
        `SELECT * FROM kalshi_trades WHERE bot = 'nightwatch' ORDER BY timestamp DESC LIMIT 100`
      );

      const resolved     = trades.filter(t => t.result !== null);
      const wins         = resolved.filter(t => t.won === true).length;
      const losses       = resolved.filter(t => t.won === false).length;
      const pending      = trades.filter(t => t.result === null && t.status === 'open').length;
      const total_staked = trades.filter(t => t.status !== 'skipped_balance').reduce((s, t) => s + parseFloat(t.cost_dollars || 0), 0);
      const total_pnl    = resolved.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
      const win_rate     = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;

      const seriesFromTicker = (ticker: string) => ticker?.split('-')[0] ?? ticker;

      const recentTrades = trades.slice(0, 20).map(t => ({
        id:          t.id,
        timestamp:   t.timestamp,
        question:    t.ticker,
        series:      seriesFromTicker(t.ticker),
        category:    seriesFromTicker(t.ticker).replace('KX', ''),
        direction:   t.side,
        side:        t.side,
        ticker:      t.ticker,
        entry_price: parseFloat(t.price_dollars),
        stake_usd:   parseFloat(t.cost_dollars),
        outcome:     t.won === true ? 'win' : t.won === false ? 'loss' : t.result === null ? 'pending' : t.status,
        pnl:         t.pnl !== null ? parseFloat(t.pnl) : null,
        reason:      t.reason,
        live:        t.live,
        order_id:    t.order_id,
      }));

      const openPositions = trades
        .filter(t => t.result === null && t.status === 'open')
        .map(t => ({
          ticker:      t.ticker,
          series:      seriesFromTicker(t.ticker),
          direction:   t.side,
          entry_price: parseFloat(t.price_dollars),
          stake_usd:   parseFloat(t.cost_dollars),
          opened_at:   t.timestamp,
          live:        t.live,
        }));

      return NextResponse.json({
        status:      'online',
        platform:    'kalshi',
        name:        'NightWatch',
        description: 'Macro event prediction bot — Fed, CPI, Tariffs (Kalshi)',
        stats: {
          totalTrades: trades.length,
          wins, losses, winRate: win_rate, pending,
          totalPnL:    Math.round(total_pnl * 100) / 100,
          totalStaked: Math.round(total_staked * 100) / 100,
          openPositions: openPositions.length,
        },
        recentTrades,
        openPositions,
        timestamp: new Date().toISOString(),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('NightWatch DB error:', error);
    return NextResponse.json({
      status: 'offline', platform: 'kalshi', name: 'NightWatch',
      description: 'Macro event prediction bot — Fed, CPI, Tariffs (Kalshi)',
      stats: null, recentTrades: [], openPositions: [], timestamp: new Date().toISOString(),
    });
  }
}
