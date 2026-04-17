import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { readFile } from 'fs/promises';
import { execSync } from 'child_process';
import { join } from 'path';

export const dynamic = 'force-dynamic';

interface KalshiTrade {
  timestamp: string;
  ticker: string;
  side: 'yes' | 'no';
  price_cents: number;
  price_dollars: number;
  contracts: number;
  cost_dollars: number;
  reason: string;
  status: string;
  live: boolean;
  order_id: string | null;
  result?: string;
  won?: boolean | null;
  pnl?: number | null;
}

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'prediction_markets_nightwatch',
    limit: 60,
    windowMs: 60_000,
  });
  if (!limiterResult.allowed) return rateLimitExceededResponse(limiterResult, 'prediction_markets_nightwatch');

  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  try {
    // Read Kalshi NightWatch trades
    const jsonlPath = join(process.env.HOME || '/Users/atlasbuilds', 'clawd/kalshi/nightwatch_trades.jsonl');
    let trades: KalshiTrade[] = [];
    try {
      const raw = await readFile(jsonlPath, 'utf-8');
      trades = raw.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    } catch { /* no trades yet */ }

    // Stats
    const resolved     = trades.filter(t => t.status === 'settled' || t.status === 'resolved' || t.result);
    const wins         = resolved.filter(t => t.won === true).length;
    const losses       = resolved.filter(t => t.won === false).length;
    const pending      = trades.filter(t => !t.result && t.status === 'open').length;
    const total_staked = trades.filter(t => t.status !== 'skipped_balance').reduce((s, t) => s + (t.cost_dollars || 0), 0);
    const total_pnl    = resolved.reduce((s, t) => s + (t.pnl || 0), 0);
    const win_rate     = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;

    // PM2 status
    let pm2Status: 'online' | 'stopped' | 'unknown' = 'unknown';
    try {
      const pm2Output = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
      const processes = JSON.parse(pm2Output);
      const proc = processes.find((p: { name: string }) => p.name === 'nightwatch');
      pm2Status = proc ? (proc as { pm2_env: { status: string } }).pm2_env.status as 'online' | 'stopped' : 'stopped';
    } catch { pm2Status = 'unknown'; }

    // Extract series from ticker (e.g. KXFEDDECISION-28JAN-H26 → KXFEDDECISION)
    const seriesFromTicker = (ticker: string) => ticker.split('-')[0];

    // Shape trades for UI
    const recentTrades = [...trades]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)
      .map(t => ({
        id:           t.ticker + '_' + t.timestamp,
        timestamp:    t.timestamp,
        question:     t.ticker,
        series:       seriesFromTicker(t.ticker),
        category:     seriesFromTicker(t.ticker).replace('KX', ''),
        direction:    t.side,
        side:         t.side,
        ticker:       t.ticker,
        entry_price:  t.price_dollars,
        stake_usd:    t.cost_dollars,
        outcome:      t.won === true ? 'win' : t.won === false ? 'loss' : t.status === 'open' ? 'pending' : t.status,
        pnl:          t.pnl ?? null,
        reason:       t.reason,
        live:         t.live,
        order_id:     t.order_id,
      }));

    // Open positions = pending trades
    const openPositions = trades
      .filter(t => !t.result && t.status === 'open')
      .map(t => ({
        ticker:      t.ticker,
        series:      seriesFromTicker(t.ticker),
        direction:   t.side,
        entry_price: t.price_dollars,
        stake_usd:   t.cost_dollars,
        opened_at:   t.timestamp,
        live:        t.live,
      }));

    return NextResponse.json({
      status:      pm2Status,
      platform:    'kalshi',
      name:        'NightWatch',
      description: 'Macro event prediction bot — Fed, CPI, Tariffs (Kalshi)',
      stats: {
        totalTrades:   trades.length,
        wins,
        losses,
        winRate:       win_rate,
        pending,
        totalPnL:      Math.round(total_pnl * 100) / 100,
        totalStaked:   Math.round(total_staked * 100) / 100,
        openPositions: openPositions.length,
      },
      recentTrades,
      openPositions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('NightWatch data fetch error:', error);
    return NextResponse.json({
      status:        'error',
      platform:      'kalshi',
      name:          'NightWatch',
      description:   'Macro event prediction bot — Fed, CPI, Tariffs (Kalshi)',
      stats:         null,
      recentTrades:  [],
      openPositions: [],
      timestamp:     new Date().toISOString(),
    });
  }
}
