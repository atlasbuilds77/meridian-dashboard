import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

// Schema for updating user settings
const updateSettingsSchema = z.object({
  trading_enabled: z.boolean().optional(),
  size_pct: z.number().min(0.01).max(1.0).optional(),
  max_position_size: z.number().positive().nullable().optional(),
  max_daily_loss: z.number().positive().nullable().optional(),
  risk_level: z.enum(['very_conservative', 'conservative', 'moderate', 'aggressive', 'maximum']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  // Rate limiting
  const limiterResult = await enforceRateLimit({
    request,
    name: 'admin_user_settings_get',
    limit: 60,
    windowMs: 60_000,
    userId: adminResult.session.dbUserId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'admin_user_settings_get');
  }

  const resolvedParams = await params;
  const userId = parseInt(resolvedParams.userId, 10);
  
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  try {
    // First, verify the user exists
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

    // Get user trading settings
    const settingsResult = await pool.query(
      `SELECT trading_enabled, size_pct, max_position_size, max_daily_loss, risk_level, created_at, updated_at
       FROM user_trading_settings
       WHERE user_id = $1`,
      [userId]
    );

    let settings = settingsResult.rows[0];

    // If no settings exist, return defaults (matching user settings API behavior)
    if (!settings) {
      settings = {
        trading_enabled: true,
        size_pct: 1.0,
        max_position_size: null,
        max_daily_loss: null,
        risk_level: null,
        created_at: null,
        updated_at: null,
      };
    }

    // Calculate risk level from size_pct if not already set
    const sizePct = parseFloat(String(settings.size_pct));
    let riskLevel: string;
    if (settings.risk_level) {
      riskLevel = settings.risk_level;
    } else {
      // Calculate based on size_pct (matching frontend logic)
      if (sizePct <= 0.10) riskLevel = 'very_conservative';
      else if (sizePct <= 0.25) riskLevel = 'conservative';
      else if (sizePct <= 0.50) riskLevel = 'moderate';
      else if (sizePct <= 0.75) riskLevel = 'aggressive';
      else riskLevel = 'maximum';
    }

    return NextResponse.json({
      user: {
        id: user.id,
        discord_id: user.discord_id,
        discord_username: user.username,
        discord_avatar: user.avatar,
      },
      settings: {
        trading_enabled: settings.trading_enabled,
        size_pct: sizePct,
        max_position_size: settings.max_position_size ? parseFloat(String(settings.max_position_size)) : null,
        // Note: max_daily_loss doesn't exist in current schema
        max_daily_loss: settings.max_daily_loss ? parseFloat(String(settings.max_daily_loss)) : null,
        risk_level: riskLevel,
        created_at: settings.created_at,
        updated_at: settings.updated_at,
      },
    });
  } catch (error: unknown) {
    console.error('Admin user settings fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  // Rate limiting
  const limiterResult = await enforceRateLimit({
    request,
    name: 'admin_user_settings_put',
    limit: 30,
    windowMs: 60_000,
    userId: adminResult.session.dbUserId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'admin_user_settings_put');
  }

  const resolvedParams = await params;
  const userId = parseInt(resolvedParams.userId, 10);
  
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  try {
    // Verify user exists
    const userResult = await pool.query(
      `SELECT id FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const payload = await request.json();
    const parsed = updateSettingsSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const { trading_enabled, size_pct, max_position_size, max_daily_loss, risk_level } = parsed.data;

    // Build update query dynamically (following user settings API pattern)
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

    if (max_daily_loss !== undefined) {
      updates.push(`max_daily_loss = $${paramIndex++}`);
      values.push(max_daily_loss);
    }

    if (risk_level !== undefined) {
      updates.push(`risk_level = $${paramIndex++}`);
      values.push(risk_level);
    }

    // If no updates provided, return error
    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE user_trading_settings
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING trading_enabled, size_pct, max_position_size, max_daily_loss, risk_level, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      // Create if doesn't exist (following user settings API pattern)
      const insertQuery = `
        INSERT INTO user_trading_settings (user_id, trading_enabled, size_pct, max_position_size, max_daily_loss, risk_level, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING trading_enabled, size_pct, max_position_size, max_daily_loss, risk_level, created_at, updated_at
      `;
      
      const insertValues = [
        userId,
        trading_enabled ?? true,
        size_pct ?? 1.0,
        max_position_size ?? null,
        max_daily_loss ?? null,
        risk_level ?? null,
      ];
      
      const insertResult = await pool.query(insertQuery, insertValues);
      var settings = insertResult.rows[0];
    } else {
      var settings = result.rows[0];
    }

    // Also update api_credentials table to keep in sync (matching admin users PATCH behavior)
    if (trading_enabled !== undefined || size_pct !== undefined) {
      const apiUpdates: string[] = [];
      const apiValues: unknown[] = [];
      let apiParamIndex = 1;

      if (trading_enabled !== undefined) {
        apiUpdates.push(`trading_enabled = $${apiParamIndex++}`);
        apiValues.push(trading_enabled);
      }

      if (size_pct !== undefined) {
        // Convert from 0.01-1.0 to 1-100 for api_credentials table
        apiUpdates.push(`size_pct = $${apiParamIndex++}`);
        apiValues.push(Math.round((size_pct * 100)));
      }

      if (apiUpdates.length > 0) {
        apiValues.push(userId);
        const apiQuery = `
          UPDATE api_credentials
          SET ${apiUpdates.join(', ')}, updated_at = NOW()
          WHERE user_id = $${apiParamIndex} AND platform = 'tradier'
        `;
        await pool.query(apiQuery, apiValues);
      }
    }

    const sizePct = parseFloat(String(settings.size_pct));
    
    // Calculate risk level if not already set
    let riskLevel: string;
    if (settings.risk_level) {
      riskLevel = settings.risk_level;
    } else {
      // Calculate based on size_pct
      if (sizePct <= 0.10) riskLevel = 'very_conservative';
      else if (sizePct <= 0.25) riskLevel = 'conservative';
      else if (sizePct <= 0.50) riskLevel = 'moderate';
      else if (sizePct <= 0.75) riskLevel = 'aggressive';
      else riskLevel = 'maximum';
    }

    return NextResponse.json({
      success: true,
      settings: {
        trading_enabled: settings.trading_enabled,
        size_pct: sizePct,
        max_position_size: settings.max_position_size ? parseFloat(String(settings.max_position_size)) : null,
        max_daily_loss: settings.max_daily_loss ? parseFloat(String(settings.max_daily_loss)) : null,
        risk_level: riskLevel,
        created_at: settings.created_at,
        updated_at: settings.updated_at,
      },
    });
  } catch (error: unknown) {
    console.error('Admin user settings update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}