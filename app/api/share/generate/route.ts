/**
 * Share Card Generation API
 * 
 * POST /api/share/generate
 * 
 * Generates a shareable P&L card for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { 
  generateShareCard, 
  calculateEdition, 
  type Edition, 
  type UserStats 
} from '@/lib/share-card-generator';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

interface GenerateCardRequest {
  userId?: string;
  edition?: Edition;
}

/**
 * Fetch user stats from database
 */
async function fetchUserStats(userId: string): Promise<UserStats | null> {
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

export async function POST(request: NextRequest) {
  try {
    const body: GenerateCardRequest = await request.json();
    const { userId, edition } = body;
    
    // Get session user ID if not provided (for user's own card)
    let targetUserId = userId;
    
    if (!targetUserId) {
      // Get from session cookie
      const sessionCookie = request.cookies.get('meridian_session');
      if (!sessionCookie) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }
      
      // Decode session to get user_id
      // TODO: Implement proper session decoding
      // For now, require userId to be passed
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }
    
    // Fetch user stats
    const stats = await fetchUserStats(targetUserId);
    
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
