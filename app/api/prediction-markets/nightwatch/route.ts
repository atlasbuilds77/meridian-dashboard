import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

function sqlite3Query(dbPath: string, query: string): string {
  try {
    return execSync(`sqlite3 "${dbPath}" "${query}"`, { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return '';
  }
}

function sqlite3Json(dbPath: string, query: string): Record<string, unknown>[] {
  try {
    const result = execSync(`sqlite3 -json "${dbPath}" "${query}"`, { encoding: 'utf-8', timeout: 5000 }).trim();
    return result ? JSON.parse(result) : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'prediction_markets_nightwatch',
    limit: 60,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'prediction_markets_nightwatch');
  }

  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  const dbPath = join(process.env.HOME || '/Users/atlasbuilds', 'clawd/weekend-bots/polymarket-ai-bot/data/bot.db');

  if (!existsSync(dbPath)) {
    return NextResponse.json({
      status: 'offline',
      name: 'NightWatch',
      description: 'Event prediction bot (politics, sports, world events)',
      stats: null,
      recentTrades: [],
      openPositions: [],
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Get pm2 status
    let pm2Status: 'online' | 'stopped' | 'unknown' = 'unknown';
    try {
      const pm2Output = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
      const processes = JSON.parse(pm2Output);
      const nwProc = processes.find((p: { name: string }) => p.name === 'nightwatch');
      pm2Status = nwProc ? (nwProc as { pm2_env: { status: string } }).pm2_env.status as 'online' | 'stopped' : 'stopped';
    } catch {
      pm2Status = 'unknown';
    }

    // Recent trades
    const recentTrades = sqlite3Json(dbPath,
      'SELECT id, order_id, market_id, token_id, side, price, size, stake_usd, status, dry_run, created_at FROM trades ORDER BY created_at DESC LIMIT 20'
    );

    // Open positions
    const openPositions = sqlite3Json(dbPath,
      'SELECT market_id, token_id, direction, entry_price, size, stake_usd, current_price, pnl, opened_at, question, market_type FROM positions'
    );

    // Stats
    const totalTrades = parseInt(sqlite3Query(dbPath, 'SELECT COUNT(*) FROM trades') || '0', 10);
    const totalStaked = parseFloat(sqlite3Query(dbPath, 'SELECT COALESCE(SUM(stake_usd), 0) FROM trades') || '0');
    const buyTrades = parseInt(sqlite3Query(dbPath, "SELECT COUNT(*) FROM trades WHERE side LIKE '%BUY%'") || '0', 10);
    const sellTrades = parseInt(sqlite3Query(dbPath, "SELECT COUNT(*) FROM trades WHERE side LIKE '%SELL%'") || '0', 10);
    const openPnL = openPositions.reduce((sum, p) => sum + (parseFloat(String(p.pnl)) || 0), 0);

    return NextResponse.json({
      status: pm2Status,
      name: 'NightWatch',
      description: 'Event prediction bot (politics, sports, world events)',
      stats: {
        totalTrades,
        buyTrades,
        sellTrades,
        totalStaked: Math.round(totalStaked * 100) / 100,
        openPositions: openPositions.length,
        openPnL: Math.round(openPnL * 100) / 100,
      },
      recentTrades,
      openPositions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('NightWatch data fetch error:', error);
    return NextResponse.json({
      status: 'error',
      name: 'NightWatch',
      description: 'Event prediction bot (politics, sports, world events)',
      stats: null,
      recentTrades: [],
      openPositions: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
