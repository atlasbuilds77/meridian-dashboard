import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import pool from '@/lib/db/pool';


export const dynamic = 'force-dynamic';


export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({ request, name: 'prediction_markets_zeus', limit: 60, windowMs: 60_000 });
  if (!limiterResult.allowed) return rateLimitExceededResponse(limiterResult, 'prediction_markets_zeus');
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  try {
    const client = await pool.connect();
    try {
      const { rows: trades } = await client.query(
        `SELECT * FROM kraken_trades WHERE bot = 'zeus' ORDER BY timestamp DESC LIMIT 100`
      );

      // Heartbeat — bot is online if last trade or heartbeat was within 20 min
      const { rows: hb } = await client.query(
        `SELECT last_seen FROM bot_heartbeats WHERE bot = 'zeus' LIMIT 1`
      );
      const lastSeen = hb[0]?.last_seen ? new Date(hb[0].last_seen) : null;
      const isOnline = lastSeen ? (Date.now() - lastSeen.getTime()) < 20 * 60 * 1000 : false;

      const closed  = trades.filter(t => t.exit_price !== null);
      const wins    = closed.filter(t => parseFloat(t.pnl_usd) > 0).length;
      const losses  = closed.filter(t => parseFloat(t.pnl_usd) <= 0).length;
      const open    = trades.filter(t => t.exit_price === null).length;
      const total_pnl = closed.reduce((s, t) => s + parseFloat(t.pnl_usd || 0), 0);
      const win_rate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;

      const recentTrades = trades.slice(0, 20).map(t => ({
        id:          t.id,
        timestamp:   t.timestamp,
        asset:       t.pair?.startsWith('BTC') ? 'BTC' : t.pair?.startsWith('ETH') ? 'ETH' : t.pair,
        direction:   t.direction,
        market_type: 'kraken',
        pair:        t.pair,
        entry_price: parseFloat(t.entry_price),
        exit_price:  t.exit_price ? parseFloat(t.exit_price) : null,
        size:        parseFloat(t.size || 0),
        leverage:    t.leverage || 2,
        outcome:     t.exit_price ? (parseFloat(t.pnl_usd) > 0 ? 'win' : 'loss') : 'open',
        profit:      t.pnl_usd !== null ? parseFloat(t.pnl_usd) : null,
        pnl_pct:     t.pnl_pct !== null ? parseFloat(t.pnl_pct) : null,
        exit_reason: t.exit_reason,
        paper:       t.paper,
      }));

      return NextResponse.json({
        status:      isOnline ? 'online' : 'offline',
        platform:    'kraken',
        name:        'Zeus',
        description: 'BTC/ETH swing trader — 1h entry + 4h trend filter, 2x leverage (Kraken)',
        stats: {
          total_trades: trades.length,
          wins, losses, open,
          total_pnl:   Math.round(total_pnl * 100) / 100,
          win_rate,
        },
        recentTrades,
        timestamp: new Date().toISOString(),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Zeus DB error:', error);
    return NextResponse.json({
      status: 'offline', platform: 'kraken', name: 'Zeus',
      description: 'BTC/ETH swing trader — 1h entry + 4h trend filter, 2x leverage (Kraken)',
      stats: null, recentTrades: [], timestamp: new Date().toISOString(),
    });
  }
}
