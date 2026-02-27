/**
 * Share Card Generation API
 * 
 * POST /api/share/generate
 * 
 * Generates a shareable P&L card for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession, requireSession } from '@/lib/api/require-auth';
import { 
  generateShareCard, 
  calculateEdition, 
  type Edition, 
  type UserStats 
} from '@/lib/share-card-generator';

interface GenerateCardRequest {
  userId?: string;
  edition?: Edition;
  mode?: 'user' | 'combined';
}

/**
 * Fetch user stats from database
 */
async function fetchUserStats(userId: number): Promise<UserStats | null> {
  const client = await pool.connect();
  
  try {
    // Get user info
    const userQuery = `
      SELECT 
        username, 
        discord_id, 
        avatar
      FROM users 
      WHERE id = $1
    `;
    const userResult = await client.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return null;
    }
    
    const user = userResult.rows[0];
    
    // Build avatar URL from Discord
    const avatarUrl = user.avatar && user.discord_id
      ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`
      : null;
    
    // Get trading stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(pnl) as total_pnl,
        MAX(pnl) as best_trade,
        SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as total_wins,
        SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) as total_losses
      FROM trades
      WHERE user_id = $1
        AND status = 'closed'
        AND pnl IS NOT NULL
    `;
    const statsResult = await client.query(statsQuery, [userId]);
    const stats = statsResult.rows[0];
    
    // Calculate metrics
    const totalTrades = parseInt(stats.total_trades) || 0;
    const wins = parseInt(stats.wins) || 0;
    const totalPnl = parseFloat(stats.total_pnl) || 0;
    const bestTrade = parseFloat(stats.best_trade) || 0;
    const totalWins = parseFloat(stats.total_wins) || 0;
    const totalLosses = parseFloat(stats.total_losses) || 0;
    
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 99.9 : 0;
    
    // Calculate return % (assuming $5000 starting capital for now)
    // TODO: Get actual starting capital from user settings
    const startingCapital = 5000;
    const returnPercent = Math.round((totalPnl / startingCapital) * 100);
    
    return {
      username: user.username,
      avatarUrl: avatarUrl || undefined,
      totalProfit: totalPnl,
      returnPercent,
      winRate,
      totalTrades,
      bestTrade,
      profitFactor,
    };
  } finally {
    client.release();
  }
}

async function fetchCombinedStats(): Promise<UserStats> {
  const client = await pool.connect();

  try {
    const combinedQuery = `
      SELECT
        COUNT(*) as total_trades,
        COUNT(DISTINCT user_id) as total_users,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(pnl) as total_pnl,
        MAX(pnl) as best_trade,
        SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as total_wins,
        SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) as total_losses
      FROM trades
      WHERE status = 'closed'
        AND pnl IS NOT NULL
    `;
    const combinedResult = await client.query(combinedQuery);
    const stats = combinedResult.rows[0] || {};

    const totalTrades = Number.parseInt(String(stats.total_trades || 0), 10) || 0;
    const totalUsers = Number.parseInt(String(stats.total_users || 0), 10) || 0;
    const wins = Number.parseInt(String(stats.wins || 0), 10) || 0;
    const totalPnl = Number.parseFloat(String(stats.total_pnl || 0)) || 0;
    const bestTrade = Number.parseFloat(String(stats.best_trade || 0)) || 0;
    const totalWins = Number.parseFloat(String(stats.total_wins || 0)) || 0;
    const totalLosses = Number.parseFloat(String(stats.total_losses || 0)) || 0;

    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 99.9 : 0;

    // Heuristic baseline for combined account return card.
    const startingCapital = Math.max(totalUsers * 5000, 5000);
    const returnPercent = Math.round((totalPnl / startingCapital) * 100);

    return {
      username: 'Meridian Combined',
      totalProfit: totalPnl,
      returnPercent,
      winRate,
      totalTrades,
      bestTrade,
      profitFactor,
    };
  } finally {
    client.release();
  }
}

function parseUserId(raw?: string): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const sessionResult = await requireSession();
    if (!sessionResult.ok) {
      return sessionResult.response;
    }

    const body: GenerateCardRequest = await request.json();
    const { userId, edition, mode = 'user' } = body;
    const session = sessionResult.session;

    let stats: UserStats | null = null;

    if (mode === 'combined') {
      const adminResult = await requireAdminSession();
      if (!adminResult.ok) {
        return adminResult.response;
      }
      stats = await fetchCombinedStats();
    } else {
      const hasUserId = typeof userId === 'string' && userId.trim().length > 0;
      const requestedUserId = parseUserId(userId);
      if (hasUserId && !requestedUserId) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
      }
      const targetUserId = requestedUserId ?? session.dbUserId;

      if (requestedUserId && requestedUserId !== session.dbUserId) {
        const adminResult = await requireAdminSession();
        if (!adminResult.ok) {
          return adminResult.response;
        }
      }

      stats = await fetchUserStats(targetUserId);
    }

    if (!stats) {
      return NextResponse.json(
        { error: 'User not found or no trading data' },
        { status: 404 }
      );
    }
    
    // Calculate edition tier if not specified
    const editionTier = edition || calculateEdition(stats.totalTrades, stats.winRate);
    
    // Generate share card
    const base64Image = await generateShareCard({
      edition: editionTier,
      stats,
    });
    
    // Return as base64 data URL
    return NextResponse.json({
      success: true,
      edition: editionTier,
      image: `data:image/png;base64,${base64Image}`,
      stats: {
        totalProfit: stats.totalProfit,
        returnPercent: stats.returnPercent,
        winRate: stats.winRate,
        totalTrades: stats.totalTrades,
      },
    });
  } catch (error: unknown) {
    console.error('Share card generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate share card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
