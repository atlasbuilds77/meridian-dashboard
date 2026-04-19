import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import pool from '@/lib/db/pool';


export const dynamic = 'force-dynamic';

function num(value: unknown, fallback = 0): number {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getAssetFromPair(pair: string | null | undefined): string {
  const p = String(pair || '').toUpperCase();
  if (p.includes('BTC') || p.includes('XBT')) return 'BTC';
  if (p.includes('ETH')) return 'ETH';
  return pair || 'UNKNOWN';
}

function krakenTickerForPair(pair: string | null | undefined): string | null {
  const asset = getAssetFromPair(pair);
  if (asset === 'BTC') return 'XXBTZUSD';
  if (asset === 'ETH') return 'XETHZUSD';
  return null;
}

async function fetchLivePricesByPair(pairs: Array<string | null | undefined>): Promise<Record<string, number>> {
  const requestedPairs = Array.from(new Set(pairs.filter(Boolean).map((p) => String(p))));
  if (requestedPairs.length === 0) return {};

  const tickerMap = new Map<string, string>();
  requestedPairs.forEach((pair) => {
    const ticker = krakenTickerForPair(pair);
    if (ticker) tickerMap.set(pair, ticker);
  });

  const tickers = Array.from(new Set(Array.from(tickerMap.values())));
  if (tickers.length === 0) return {};

  try {
    const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${tickers.join(',')}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return {};

    const data = await res.json() as { result?: Record<string, { c?: [string] }> };
    const result = data?.result ?? {};

    const pricesByPair: Record<string, number> = {};
    for (const [pair, ticker] of tickerMap.entries()) {
      const close = result?.[ticker]?.c?.[0];
      const price = num(close, NaN);
      if (Number.isFinite(price)) pricesByPair[pair] = price;
    }

    return pricesByPair;
  } catch {
    return {};
  }
}

function computeLivePnlUsd(trade: { direction?: string | null; entry_price?: unknown; size?: unknown; pair?: string | null }, pricesByPair: Record<string, number>): number | null {
  const pair = String(trade.pair || '');
  const current = pricesByPair[pair];
  if (!Number.isFinite(current)) return null;

  const entry = num(trade.entry_price, NaN);
  const size = num(trade.size, NaN);
  if (!Number.isFinite(entry) || !Number.isFinite(size) || size === 0) return null;

  const d = String(trade.direction || '').toLowerCase();
  const isShort = d.includes('short') || d.includes('bear') || d.includes('sell');
  const pnl = isShort ? (entry - current) * size : (current - entry) * size;

  return round2(pnl);
}


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

      const openTrades = trades.filter(t => t.exit_price === null);
      const livePricesByPair = await fetchLivePricesByPair(openTrades.map(t => t.pair));

      // Heartbeat — bot is online if last trade or heartbeat was within 20 min
      const { rows: hb } = await client.query(
        `SELECT last_seen FROM bot_heartbeats WHERE bot = 'zeus' LIMIT 1`
      );
      const lastSeen = hb[0]?.last_seen ? new Date(hb[0].last_seen) : null;
      const isOnline = lastSeen ? (Date.now() - lastSeen.getTime()) < 20 * 60 * 1000 : false;

      const closed  = trades.filter(t => t.exit_price !== null);
      const wins    = closed.filter(t => num(t.pnl_usd) > 0).length;
      const losses  = closed.filter(t => num(t.pnl_usd) <= 0).length;
      const open    = openTrades.length;
      const total_pnl = closed.reduce((s, t) => s + num(t.pnl_usd || 0), 0);
      const open_pnl = openTrades.reduce((sum, t) => {
        const pnl = computeLivePnlUsd(t, livePricesByPair);
        return sum + (pnl ?? 0);
      }, 0);
      const win_rate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;

      const recentTrades = trades.slice(0, 20).map((t) => ({
        ...t,
        livePnl: t.exit_price === null ? computeLivePnlUsd(t, livePricesByPair) : null,
      })).map((t) => ({
        id:          t.id,
        timestamp:   t.timestamp,
        asset:       getAssetFromPair(t.pair),
        direction:   t.direction,
        market_type: 'kraken',
        pair:        t.pair,
        entry_price: num(t.entry_price),
        exit_price:  t.exit_price ? num(t.exit_price) : null,
        current_price: t.exit_price === null ? (livePricesByPair[String(t.pair || '')] ?? null) : null,
        size:        num(t.size || 0),
        leverage:    t.leverage || 2,
        outcome:     t.exit_price ? (num(t.pnl_usd) > 0 ? 'win' : 'loss') : 'open',
        pnl_usd:     t.exit_price === null ? t.livePnl : (t.pnl_usd !== null ? num(t.pnl_usd) : null),
        profit:      t.exit_price === null ? t.livePnl : (t.pnl_usd !== null ? num(t.pnl_usd) : null),
        pnl_pct:     t.pnl_pct !== null ? num(t.pnl_pct) : null,
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
          open_pnl:    round2(open_pnl),
          total_with_open_pnl: round2(total_pnl + open_pnl),
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
