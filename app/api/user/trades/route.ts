import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { TradeSchema, TradeUpdateSchema } from '@/lib/validation/schemas';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { validateCsrfFromRequest } from '@/lib/security/csrf';
import format from 'pg-format';

export const dynamic = 'force-dynamic';

function normalizeDirection(direction: string): 'LONG' | 'SHORT' | 'CALL' | 'PUT' {
  const normalized = direction.toUpperCase();
  if (normalized === 'LONG' || normalized === 'SHORT' || normalized === 'CALL' || normalized === 'PUT') {
    return normalized;
  }
  return 'LONG';
}

function calculateTradePnl(params: {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  direction: string;
  assetType: string;
}): { pnl: number; pnlPercent: number } {
  const contractMultiplier = params.assetType === 'option' || params.assetType === 'future' ? 100 : 1;
  const directionMultiplier =
    params.direction === 'SHORT' || params.direction === 'PUT' ? -1 : 1;

  const rawChange = params.exitPrice - params.entryPrice;

  return {
    pnl: rawChange * params.quantity * contractMultiplier * directionMultiplier,
    pnlPercent: (rawChange / params.entryPrice) * 100 * directionMultiplier,
  };
}

export async function GET(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_trades_read',
    limit: 120,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_trades_read');
  }

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number.parseInt(searchParams.get('limit') || '100', 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 500))
    : 100;

  try {
    const tradesResult = await pool.query(
      `SELECT * FROM trades
       WHERE user_id = $1
       ORDER BY entry_date DESC
       LIMIT $2`,
      [authResult.userId, limit]
    );

    const summaryResult = await pool.query(
      `SELECT
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE pnl > 0) as wins,
        COUNT(*) FILTER (WHERE pnl < 0) as losses,
        COALESCE(SUM(pnl), 0) as total_pnl,
        COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0) as avg_win,
        COALESCE(AVG(pnl) FILTER (WHERE pnl < 0), 0) as avg_loss,
        COALESCE(100.0 * COUNT(*) FILTER (WHERE pnl > 0) / NULLIF(COUNT(*), 0), 0) as win_rate
       FROM trades
       WHERE user_id = $1 AND status = 'closed'`,
      [authResult.userId]
    );

    const summary = summaryResult.rows[0] || {};
    const avgLoss = Number.parseFloat(String(summary.avg_loss || 0)) || 0;
    const avgWin = Number.parseFloat(String(summary.avg_win || 0)) || 0;

    return NextResponse.json({
      trades: tradesResult.rows,
      summary: {
        totalTrades: Number.parseInt(String(summary.total_trades || 0), 10) || 0,
        wins: Number.parseInt(String(summary.wins || 0), 10) || 0,
        losses: Number.parseInt(String(summary.losses || 0), 10) || 0,
        totalPnL: Number.parseFloat(String(summary.total_pnl || 0)) || 0,
        avgWin,
        avgLoss,
        winRate: Number.parseFloat(String(summary.win_rate || 0)) || 0,
        profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? 999 : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Trades fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_trades_write',
    limit: 60,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_trades_write');
  }

  try {
    const body = await request.json();
    const validation = TradeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const trade = validation.data;
    const direction = normalizeDirection(trade.direction);

    let pnl: number | null = null;
    let pnlPercent: number | null = null;

    if (trade.exit_price !== undefined) {
      const calculated = calculateTradePnl({
        entryPrice: trade.entry_price,
        exitPrice: trade.exit_price,
        quantity: trade.quantity,
        direction,
        assetType: trade.asset_type,
      });
      pnl = calculated.pnl;
      pnlPercent = calculated.pnlPercent;
    }

    if (trade.account_id) {
      const ownerCheck = await pool.query('SELECT user_id FROM accounts WHERE id = $1', [trade.account_id]);
      if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== authResult.userId) {
        return NextResponse.json({ error: 'Invalid account_id' }, { status: 400 });
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
        authResult.userId,
        trade.account_id || null,
        trade.symbol.toUpperCase(),
        direction,
        trade.asset_type,
        trade.strike || null,
        trade.expiry || null,
        trade.entry_price,
        trade.exit_price || null,
        trade.quantity,
        trade.entry_date,
        trade.exit_date || null,
        pnl,
        pnlPercent,
        trade.status,
        trade.notes || null,
        trade.chart_url || null,
      ]
    );

    return NextResponse.json({ success: true, trade: result.rows[0] });
  } catch (error) {
    console.error('Trade creation error:', error);
    return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_trades_write',
    limit: 60,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_trades_write');
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body as { id?: number; [key: string]: unknown };

    if (!id) {
      return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 });
    }

    const validation = TradeUpdateSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const validatedUpdates = validation.data;
    if (Object.keys(validatedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const ownerCheck = await pool.query(
      'SELECT user_id, entry_price, quantity, direction, asset_type FROM trades WHERE id = $1',
      [id]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== authResult.userId) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const existingTrade = ownerCheck.rows[0] as {
      user_id: number;
      entry_price: number;
      quantity: number;
      direction: string;
      asset_type: string;
    };

    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (validatedUpdates.exit_price !== undefined) {
      const direction = normalizeDirection(existingTrade.direction);
      const calculated = calculateTradePnl({
        entryPrice: Number(existingTrade.entry_price),
        exitPrice: validatedUpdates.exit_price,
        quantity: Number(existingTrade.quantity),
        direction,
        assetType: existingTrade.asset_type,
      });

      updateFields.push(`exit_price = $${paramCount++}`);
      values.push(validatedUpdates.exit_price);

      updateFields.push(`pnl = $${paramCount++}`);
      values.push(calculated.pnl);

      updateFields.push(`pnl_percent = $${paramCount++}`);
      values.push(calculated.pnlPercent);
    }

    for (const [key, value] of Object.entries(validatedUpdates)) {
      if (key !== 'exit_price') {
        // Use pg-format to safely escape column identifier
        updateFields.push(format('%I = $%s', key, paramCount++));
        values.push(value);
      }
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const idParam = paramCount++;
    const userIdParam = paramCount++;

    const result = await pool.query(
      `UPDATE trades SET ${updateFields.join(', ')} WHERE id = $${idParam} AND user_id = $${userIdParam} RETURNING *`,
      [...values, id, authResult.userId]
    );

    return NextResponse.json({ success: true, trade: result.rows[0] });
  } catch (error) {
    console.error('Trade update error:', error);
    return NextResponse.json({ error: 'Failed to update trade' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_trades_write',
    limit: 60,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_trades_write');
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 });
  }

  try {
    const result = await pool.query('DELETE FROM trades WHERE id = $1 AND user_id = $2 RETURNING id', [
      id,
      authResult.userId,
    ]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Trade deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete trade' }, { status: 500 });
  }
}
