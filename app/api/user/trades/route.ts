import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';
import { TradeSchema, TradeUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

// GET - List user's trades
export async function GET(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500); // FIXED: Capped at 500
  
  try {
    // Get trades
    const tradesResult = await pool.query(
      `SELECT * FROM trades 
       WHERE user_id = $1 
       ORDER BY entry_date DESC 
       LIMIT $2`,
      [userId, limit]
    );
    
    // Calculate summary
    const summaryResult = await pool.query(
      `SELECT 
        COUNT(*) as total_trades,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as wins,
        COUNT(CASE WHEN pnl < 0 THEN 1 END) as losses,
        COALESCE(SUM(pnl), 0) as total_pnl,
        COALESCE(AVG(CASE WHEN pnl > 0 THEN pnl END), 0) as avg_win,
        COALESCE(AVG(CASE WHEN pnl < 0 THEN pnl END), 0) as avg_loss,
        CASE 
          WHEN COUNT(*) > 0 
          THEN ROUND((COUNT(CASE WHEN pnl > 0 THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100, 2)
          ELSE 0 
        END as win_rate
       FROM trades 
       WHERE user_id = $1 AND status = 'closed'`,
      [userId]
    );
    
    const summary = summaryResult.rows[0];
    
    return NextResponse.json({
      trades: tradesResult.rows,
      summary: {
        totalTrades: parseInt(summary.total_trades),
        wins: parseInt(summary.wins),
        losses: parseInt(summary.losses),
        totalPnL: parseFloat(summary.total_pnl),
        avgWin: parseFloat(summary.avg_win),
        avgLoss: parseFloat(summary.avg_loss),
        winRate: parseFloat(summary.win_rate),
        profitFactor: summary.avg_loss !== 0 
          ? Math.abs(parseFloat(summary.avg_win) / parseFloat(summary.avg_loss))
          : parseFloat(summary.avg_win) > 0 ? Infinity : 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Trades fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}

// POST - Add new trade
export async function POST(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    
    // FIXED: Zod validation
    const validation = TradeSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }
    
    const trade = validation.data;
    
    // Calculate P&L if exit price provided
    let pnl = null;
    let pnl_percent = null;
    
    if (trade.exit_price) {
      // FIXED: Contract multiplier for options/futures
      const contractMultiplier = (trade.asset_type === 'option' || trade.asset_type === 'future') ? 100 : 1;
      const directionMultiplier = trade.direction === 'SHORT' || trade.direction === 'PUT' ? -1 : 1;
      
      pnl = (trade.exit_price - trade.entry_price) * trade.quantity * contractMultiplier * directionMultiplier;
      pnl_percent = ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100 * directionMultiplier;
    }
    
    // If account_id provided, verify ownership
    if (trade.account_id) {
      const ownerCheck = await pool.query(
        'SELECT user_id FROM accounts WHERE id = $1',
        [trade.account_id]
      );
      
      if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== userId) {
        return NextResponse.json(
          { error: 'Invalid account_id' },
          { status: 400 }
        );
      }
    }
    
    const result = await pool.query(
      `INSERT INTO trades (
        user_id, account_id, symbol, direction, asset_type,
        strike, expiry, entry_price, exit_price, quantity,
        entry_date, exit_date, pnl, pnl_percent, status, notes, chart_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        userId,
        trade.account_id || null,
        trade.symbol.toUpperCase(),
        trade.direction,
        trade.asset_type,
        trade.strike || null,
        trade.expiry || null,
        trade.entry_price,
        trade.exit_price || null,
        trade.quantity,
        trade.entry_date,
        trade.exit_date || null,
        pnl,
        pnl_percent,
        trade.status,
        trade.notes || null,
        trade.chart_url || null
      ]
    );
    
    return NextResponse.json({
      success: true,
      trade: result.rows[0]
    });
  } catch (error) {
    console.error('Trade creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create trade' },
      { status: 500 }
    );
  }
}

// PATCH - Update trade
export async function PATCH(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Trade ID is required' },
        { status: 400 }
      );
    }
    
    // FIXED: Zod validation for partial updates
    const validation = TradeUpdateSchema.safeParse(updates);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }
    
    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT user_id, entry_price, quantity, direction, asset_type FROM trades WHERE id = $1',
      [id]
    );
    
    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== userId) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }
    
    const existingTrade = ownerCheck.rows[0];
    const updateFields: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;
    
    const validatedUpdates = validation.data;
    
    // Recalculate P&L if exit_price changed
    if (validatedUpdates.exit_price !== undefined) {
      const contractMultiplier = (existingTrade.asset_type === 'option' || existingTrade.asset_type === 'future') ? 100 : 1;
      const directionMultiplier = existingTrade.direction === 'SHORT' || existingTrade.direction === 'PUT' ? -1 : 1;
      
      const pnl = (validatedUpdates.exit_price - existingTrade.entry_price) * existingTrade.quantity * contractMultiplier * directionMultiplier;
      const pnl_percent = ((validatedUpdates.exit_price - existingTrade.entry_price) / existingTrade.entry_price) * 100 * directionMultiplier;
      
      updateFields.push(`exit_price = $${paramCount++}`);
      values.push(validatedUpdates.exit_price);
      
      updateFields.push(`pnl = $${paramCount++}`);
      values.push(pnl);
      
      updateFields.push(`pnl_percent = $${paramCount++}`);
      values.push(pnl_percent);
    }
    
    // Apply other updates
    for (const [key, value] of Object.entries(validatedUpdates)) {
      if (key !== 'exit_price') { // Already handled above
        updateFields.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    const result = await pool.query(
      `UPDATE trades SET ${updateFields.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [...values, userId]
    );
    
    return NextResponse.json({
      success: true,
      trade: result.rows[0]
    });
  } catch (error) {
    console.error('Trade update error:', error);
    return NextResponse.json(
      { error: 'Failed to update trade' },
      { status: 500 }
    );
  }
}

// DELETE - Remove trade
export async function DELETE(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json(
      { error: 'Trade ID is required' },
      { status: 400 }
    );
  }
  
  try {
    // Verify ownership and delete
    const result = await pool.query(
      'DELETE FROM trades WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      deletedId: id
    });
  } catch (error) {
    console.error('Trade deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete trade' },
      { status: 500 }
    );
  }
}
