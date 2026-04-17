import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({ request, name: 'prediction_markets_oracle', limit: 60, windowMs: 60_000 });
  if (!limiterResult.allowed) return rateLimitExceededResponse(limiterResult, 'prediction_markets_oracle');
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  try {
    const client = await pool.connect();
    try {
      // All Oracle trades
      const { rows: trades } = await client.query(
        `SELECT * FROM kalshi_trades WHERE bot = 'oracle' ORDER BY timestamp DESC LIMIT 100`
      );

      const resolved = trades.filter(t => t.result !== null);
      const wins     = resolved.filter(t => t.won === true).length;
      const losses   = resolved.filter(t => t.won === false).length;
      const pending  = trades.filter(t => t.result === null && t.status === 'open').length;
      const total_invested = trades.filter(t => t.status !== 'skipped_balance').reduce((s, t) => s + parseFloat(t.cost_dollars || 0), 0);
      const total_profit   = resolved.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
      const win_rate = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;

      const recentTrades = trades.slice(0, 20).map(t => ({
        id:          t.id,
        timestamp:   t.timestamp,
        asset:       t.ticker?.startsWith('KXBTCD') ? 'BTC' : t.ticker?.startsWith('KXETHUSD') ? 'ETH' : t.ticker?.split('-')[0],
        direction:   t.side === 'yes' ? 'up' : 'down',
        market_type: 'kalshi',
        ticker:      t.ticker,
        side:        t.side,
        entry_price: parseFloat(t.price_dollars),
        cost:        parseFloat(t.cost_dollars),
        outcome:     t.won === true ? 'win' : t.won === false ? 'loss' : t.result === null ? 'pending' : t.status,
        profit:      t.pnl !== null ? parseFloat(t.pnl) : null,
        reason:      t.reason,
        live:        t.live,
        order_id:    t.order_id,
      }));

      return NextResponse.json({
        status:      'online',
        platform:    'kalshi',
        name:        'Oracle',
        description: 'BTC/ETH daily price direction bot (Kalshi)',
        stats: {
          total_trades:   trades.length,
          wins, losses, pending,
          total_invested: Math.round(total_invested * 100) / 100,
          total_profit:   Math.round(total_profit * 100) / 100,
          win_rate,
        },
        recentTrades,
        timestamp: new Date().toISOString(),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Oracle DB error:', error);
    return NextResponse.json({
      status: 'offline', platform: 'kalshi', name: 'Oracle',
      description: 'BTC/ETH daily price direction bot (Kalshi)',
      stats: null, recentTrades: [], timestamp: new Date().toISOString(),
    });
  }
}
