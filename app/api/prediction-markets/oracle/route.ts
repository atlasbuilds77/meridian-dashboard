import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { readFile } from 'fs/promises';
import { execSync } from 'child_process';
import { join } from 'path';

export const dynamic = 'force-dynamic';

interface OracleTrade {
  id: number;
  timestamp: string;
  asset: string;
  direction: string;
  market_type: string;
  shares: number;
  entry_price: number;
  cost: number;
  edge: number;
  model_prob: number;
  outcome: string;
  payout: number;
  profit: number;
  resolved_at?: string;
  resolution_data?: {
    open_price: number;
    close_price: number;
    price_change_pct: number;
  };
}

interface OracleData {
  trades: OracleTrade[];
  stats: {
    total_trades: number;
    wins: number;
    losses: number;
    pending: number;
    total_invested: number;
    total_returned: number;
    total_profit: number;
    win_rate: number;
  };
}

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'prediction_markets_oracle',
    limit: 60,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'prediction_markets_oracle');
  }

  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    // Read JSONL trade history (current format)
    const jsonlPath = join(process.env.HOME || '/Users/atlasbuilds', 'clawd/oracle/trade-history.jsonl');
    let trades: OracleTrade[] = [];
    try {
      const raw = await readFile(jsonlPath, 'utf-8');
      trades = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    } catch {
      // fallback to legacy JSON
      try {
        const legacyPath = join(process.env.HOME || '/Users/atlasbuilds', 'clawd/oracle/trade-history.json');
        const raw = await readFile(legacyPath, 'utf-8');
        const data: OracleData = JSON.parse(raw);
        trades = data.trades || [];
      } catch { /* no trades yet */ }
    }

    // Compute stats from trades
    const resolved = trades.filter(t => t.outcome === 'win' || t.outcome === 'loss');
    const wins = resolved.filter(t => t.outcome === 'win').length;
    const losses = resolved.filter(t => t.outcome === 'loss').length;
    const pending = trades.filter(t => !t.outcome || t.outcome === 'pending').length;
    const total_invested = trades.reduce((s, t) => s + (t.cost || 0), 0);
    const total_returned = trades.reduce((s, t) => s + (t.payout || 0), 0);
    const total_profit = total_returned - total_invested;
    const win_rate = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;

    // Get pm2 status
    let pm2Status: 'online' | 'stopped' | 'unknown' = 'unknown';
    try {
      const pm2Output = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
      const processes = JSON.parse(pm2Output);
      const oracleProc = processes.find((p: { name: string }) => p.name === 'oracle');
      pm2Status = oracleProc ? (oracleProc as { pm2_env: { status: string } }).pm2_env.status as 'online' | 'stopped' : 'stopped';
    } catch {
      pm2Status = 'unknown';
    }

    // Recent trades (last 20, newest first)
    const recentTrades = [...trades]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    return NextResponse.json({
      status: pm2Status,
      name: 'Oracle',
      description: 'BTC/ETH/SOL 15-min crypto prediction bot',
      stats: { total_trades: trades.length, wins, losses, pending, total_invested, total_returned, total_profit, win_rate },
      recentTrades,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Oracle data fetch error:', error);
    return NextResponse.json({
      status: 'offline',
      name: 'Oracle',
      description: 'BTC/ETH/SOL 15-min crypto prediction bot',
      stats: null,
      recentTrades: [],
      timestamp: new Date().toISOString(),
    });
  }
}
