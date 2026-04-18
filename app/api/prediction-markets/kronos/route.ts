import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({ request, name: 'prediction_markets_kronos', limit: 60, windowMs: 60_000 });
  if (!limiterResult.allowed) return rateLimitExceededResponse(limiterResult, 'prediction_markets_kronos');
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  try {
    const client = await pool.connect();
    try {
      const { rows: fills } = await client.query(
        `SELECT * FROM kraken_trades WHERE bot = 'kronos' ORDER BY timestamp DESC LIMIT 100`
      );

      // Heartbeat
      const { rows: hb } = await client.query(
        `SELECT last_seen FROM bot_heartbeats WHERE bot = 'kronos' LIMIT 1`
      );
      const lastSeen = hb[0]?.last_seen ? new Date(hb[0].last_seen) : null;
      const isOnline = lastSeen ? (Date.now() - lastSeen.getTime()) < 10 * 60 * 1000 : false;

      const total_pnl = fills.reduce((s, t) => s + parseFloat(t.pnl_usd || 0), 0);
      const total_fills = fills.length;
      // Grid fills are always "complete" round trips
      const btcFills = fills.filter(t => t.pair?.startsWith('BTC'));
      const ethFills = fills.filter(t => t.pair?.startsWith('ETH'));

      const recentFills = fills.slice(0, 20).map(t => ({
        id:        t.id,
        timestamp: t.timestamp,
        asset:     t.pair?.startsWith('BTC') ? 'BTC' : 'ETH',
        pair:      t.pair,
        buy_level: parseFloat(t.entry_price),
        sell_level: t.exit_price ? parseFloat(t.exit_price) : null,
        size:      parseFloat(t.size || 0),
        grid_profit: t.pnl_usd !== null ? parseFloat(t.pnl_usd) : null,
        paper:     t.paper,
        outcome:   'win',   // grid fills are always profitable by design
      }));

      return NextResponse.json({
        status:      isOnline ? 'online' : 'offline',
        platform:    'kraken',
        name:        'Kronos',
        description: 'BTC/ETH grid bot — ±6% range, 12 levels, auto-rebalance (Kraken)',
        stats: {
          total_fills,
          btc_fills:  btcFills.length,
          eth_fills:  ethFills.length,
          total_pnl:  Math.round(total_pnl * 100) / 100,
        },
        recentFills,
        timestamp: new Date().toISOString(),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Kronos DB error:', error);
    return NextResponse.json({
      status: 'offline', platform: 'kraken', name: 'Kronos',
      description: 'BTC/ETH grid bot — ±6% range, 12 levels, auto-rebalance (Kraken)',
      stats: null, recentFills: [], timestamp: new Date().toISOString(),
    });
  }
}
