import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import pool from '@/lib/db/pool';
import { isDuplicateRequest, clearPendingRequest } from '@/lib/security/request-dedup';

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    // Get user trading settings
    const result = await client.query(
      `SELECT trading_enabled, size_pct, max_position_size, updated_at
       FROM user_trading_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default settings if none exist
      await client.query(
        `INSERT INTO user_trading_settings (user_id, trading_enabled, size_pct)
         VALUES ($1, true, 1.0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      return NextResponse.json({
        trading_enabled: true,
        size_pct: 1.0,
        max_position_size: null,
      });
    }

    const settings = result.rows[0];
    return NextResponse.json({
      trading_enabled: settings.trading_enabled,
      size_pct: parseFloat(settings.size_pct),
      max_position_size: settings.max_position_size ? parseFloat(settings.max_position_size) : null,
      updated_at: settings.updated_at,
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bodyText = await req.text();
  const body = JSON.parse(bodyText);
  const { trading_enabled, size_pct, max_position_size } = body;

  // Request deduplication - Prevent rapid-fire duplicate setting changes
  const isDuplicate = await isDuplicateRequest(
    userId.toString(),
    '/api/user/settings',
    'PATCH',
    bodyText,
    2000 // 2 second window
  );

  if (isDuplicate) {
    console.warn('[Settings] Duplicate request blocked', {
      userId,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { 
        error: 'Duplicate request detected. Please wait a moment before trying again.',
        code: 'DUPLICATE_REQUEST',
      },
      { status: 429 }
    );
  }

  // Validation
  if (size_pct !== undefined) {
    if (typeof size_pct !== 'number' || size_pct < 0.01 || size_pct > 1.0) {
      return NextResponse.json(
        { error: 'size_pct must be between 0.01 (1%) and 1.0 (100%)' },
        { status: 400 }
      );
    }
  }

  if (max_position_size !== undefined && max_position_size !== null) {
    if (typeof max_position_size !== 'number' || max_position_size <= 0) {
      return NextResponse.json(
        { error: 'max_position_size must be positive or null' },
        { status: 400 }
      );
    }
  }

  const client = await pool.connect();
  try {
    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (trading_enabled !== undefined) {
      updates.push(`trading_enabled = $${paramIndex++}`);
      values.push(trading_enabled);
    }

    if (size_pct !== undefined) {
      updates.push(`size_pct = $${paramIndex++}`);
      values.push(size_pct);
    }

    if (max_position_size !== undefined) {
      updates.push(`max_position_size = $${paramIndex++}`);
      values.push(max_position_size);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE user_trading_settings
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING trading_enabled, size_pct, max_position_size, updated_at
    `;

    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      // Create if doesn't exist
      await client.query(
        `INSERT INTO user_trading_settings (user_id, trading_enabled, size_pct, max_position_size)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
         SET trading_enabled = EXCLUDED.trading_enabled,
             size_pct = EXCLUDED.size_pct,
             max_position_size = EXCLUDED.max_position_size,
             updated_at = NOW()
         RETURNING trading_enabled, size_pct, max_position_size`,
        [userId, trading_enabled ?? true, size_pct ?? 1.0, max_position_size ?? null]
      );
    }

    clearPendingRequest(userId.toString(), '/api/user/settings', 'PATCH');
    return NextResponse.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    console.error('Failed to update settings:', error);
    clearPendingRequest(userId.toString(), '/api/user/settings', 'PATCH');
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  } finally {
    client.release();
  }
}
