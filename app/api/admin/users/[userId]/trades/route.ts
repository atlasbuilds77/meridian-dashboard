import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const resolvedParams = await params;
  const userId = parseInt(resolvedParams.userId, 10);
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  try {
    // Get user info
    const userResult = await pool.query(
      `SELECT id, discord_id, username, avatar
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Get user's trades
    const tradesResult = await pool.query(
      `SELECT 
        id, symbol, direction, entry_price, exit_price, quantity,
        entry_date, exit_date, pnl, pnl_percent, status,
        setup_type, stop_loss, take_profit, entry_reasoning
       FROM trades
       WHERE user_id = $1
       ORDER BY entry_date DESC`,
      [userId]
    );

    // Calculate stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE pnl > 0) as wins,
        COUNT(*) FILTER (WHERE pnl <= 0) as losses,
        COALESCE(SUM(pnl), 0) as total_pnl,
        COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0) as avg_win,
        COALESCE(AVG(pnl) FILTER (WHERE pnl <= 0), 0) as avg_loss,
        COALESCE(100.0 * COUNT(*) FILTER (WHERE pnl > 0) / NULLIF(COUNT(*), 0), 0) as win_rate
       FROM trades
       WHERE user_id = $1 AND status = 'closed'`,
      [userId]
    );

    const stats = statsResult.rows[0] || {
      total_trades: 0,
      wins: 0,
      losses: 0,
      total_pnl: 0,
      avg_win: 0,
      avg_loss: 0,
      win_rate: 0,
    };

    return NextResponse.json({
      user: {
        id: user.id,
        discord_id: user.discord_id,
        discord_username: user.username,
        discord_avatar: user.avatar,
      },
      trades: tradesResult.rows.map((trade: any) => ({
        ...trade,
        entry_price: parseFloat(String(trade.entry_price)),
        exit_price: trade.exit_price ? parseFloat(String(trade.exit_price)) : null,
        pnl: parseFloat(String(trade.pnl || 0)),
        pnl_percent: parseFloat(String(trade.pnl_percent || 0)),
        stop_loss: trade.stop_loss ? parseFloat(String(trade.stop_loss)) : null,
        take_profit: trade.take_profit ? parseFloat(String(trade.take_profit)) : null,
      })),
      stats: {
        total_trades: parseInt(String(stats.total_trades), 10),
        wins: parseInt(String(stats.wins), 10),
        losses: parseInt(String(stats.losses), 10),
        total_pnl: parseFloat(String(stats.total_pnl)),
        win_rate: parseFloat(String(stats.win_rate)),
        avg_win: parseFloat(String(stats.avg_win)),
        avg_loss: parseFloat(String(stats.avg_loss)),
      },
    });
  } catch (error: unknown) {
    console.error('User trades fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
