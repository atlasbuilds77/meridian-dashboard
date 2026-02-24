import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

const updateSchema = z
  .object({
    user_id: z.number().int().positive(),
    trading_enabled: z.boolean().optional(),
    size_pct: z.number().int().min(1).max(100).optional(),
  })
  .refine((value) => value.trading_enabled !== undefined || value.size_pct !== undefined, {
    message: 'No valid updates provided',
  });

export async function GET() {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  try {
    const { rows } = await pool.query(`
      WITH trade_pnl AS (
        SELECT
          t.user_id,
          t.id,
          COALESCE(
            t.pnl,
            CASE
              WHEN t.exit_price IS NULL THEN NULL
              WHEN UPPER(t.direction) IN ('LONG', 'CALL')
                THEN (t.exit_price - t.entry_price) * t.quantity * CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
              WHEN UPPER(t.direction) IN ('SHORT', 'PUT')
                THEN (t.entry_price - t.exit_price) * t.quantity * CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
              ELSE NULL
            END
          ) AS pnl_value
        FROM trades t
        WHERE t.status = 'closed'
      )
      SELECT
        u.id,
        u.discord_id,
        u.username,
        u.avatar,
        u.created_at,
        u.last_login,
        ac.account_number,
        ac.platform,
        ac.verification_status,
        ac.trading_enabled,
        ac.size_pct,
        COUNT(tp.id) AS trades_count,
        COALESCE(SUM(tp.pnl_value), 0) AS total_pnl,
        COALESCE(
          100.0 * COUNT(*) FILTER (WHERE tp.pnl_value > 0) / NULLIF(COUNT(tp.id), 0),
          0
        ) AS win_rate
      FROM users u
      LEFT JOIN api_credentials ac ON ac.user_id = u.id AND ac.platform = 'tradier'
      LEFT JOIN trade_pnl tp ON tp.user_id = u.id
      GROUP BY
        u.id,
        ac.account_number,
        ac.platform,
        ac.verification_status,
        ac.trading_enabled,
        ac.size_pct
      ORDER BY u.created_at DESC
    `);

    const users = rows.map((row: any) => ({
      user: {
        id: row.id,
        discord_id: row.discord_id,
        discord_username: row.username,
        discord_avatar: row.avatar,
        created_at: row.created_at,
        last_login: row.last_login,
      },
      account: row.account_number
        ? {
            user_id: row.id,
            account_number: row.account_number,
            platform: row.platform,
            verified: row.verification_status === 'verified',
            trading_enabled: row.trading_enabled,
            size_pct: row.size_pct,
          }
        : null,
      trades_count: Number.parseInt(String(row.trades_count), 10) || 0,
      total_pnl: Number.parseFloat(String(row.total_pnl)) || 0,
      win_rate: Number.parseFloat(String(row.win_rate)) || 0,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request: req,
    name: 'admin_users_patch',
    limit: 60,
    windowMs: 60_000,
    userId: adminResult.session.dbUserId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'admin_users_patch');
  }

  try {
    const payload = await req.json();
    const parsed = updateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const { user_id, trading_enabled, size_pct } = parsed.data;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (typeof trading_enabled === 'boolean') {
      updates.push(`trading_enabled = $${paramIndex++}`);
      values.push(trading_enabled);
    }

    if (typeof size_pct === 'number') {
      updates.push(`size_pct = $${paramIndex++}`);
      values.push(size_pct);
    }

    values.push(user_id);

    // Update BOTH tables to keep them in sync (trading system reads from user_trading_settings)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update api_credentials
      const apiCredQuery = `
        UPDATE api_credentials
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE user_id = $${paramIndex} AND platform = 'tradier'
        RETURNING *
      `;
      const apiResult = await client.query(apiCredQuery, values);
      
      if (apiResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      
      // Also update user_trading_settings (meridian_trader reads from this table)
      // Convert size_pct from 1-100 (dashboard) to 0.0-1.0 (trading system)
      if (typeof size_pct === 'number' || typeof trading_enabled === 'boolean') {
        const upsertCols: string[] = [];
        const upsertVals: unknown[] = [user_id]; // user_id is always first
        let upsertIdx = 2; // Start from $2 since $1 is user_id

        if (typeof trading_enabled === 'boolean') {
          upsertCols.push('trading_enabled');
          upsertVals.push(trading_enabled);
          upsertIdx++;
        }

        if (typeof size_pct === 'number') {
          upsertCols.push('size_pct');
          upsertVals.push(size_pct / 100); // Convert 1-100 → 0.0-1.0
          upsertIdx++;
        }

        const colsList = upsertCols.join(', ');
        const valsList = upsertVals.slice(1).map((_, i) => `$${i + 2}`).join(', ');
        const updateSet = upsertCols.map((col, i) => `${col} = $${i + 2}`).join(', ');

        const settingsQuery = `
          INSERT INTO user_trading_settings (user_id, ${colsList}, updated_at)
          VALUES ($1, ${valsList}, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET ${updateSet}, updated_at = NOW()
        `;
        
        await client.query(settingsQuery, upsertVals);
      }
      
      await client.query('COMMIT');
      return NextResponse.json({ success: true, account: apiResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
