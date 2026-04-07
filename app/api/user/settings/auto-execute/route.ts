import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { validateCsrfFromRequest } from '@/lib/security/csrf';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/settings/auto-execute
 * Returns current auto-execute status for the logged-in user.
 */
export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  try {
    const result = await pool.query(
      `SELECT auto_execute_enabled FROM users WHERE id = $1`,
      [userId]
    );

    return NextResponse.json({
      auto_execute_enabled: result.rows[0]?.auto_execute_enabled ?? false,
    });
  } catch (error: unknown) {
    console.error('[AutoExecute] Failed to fetch setting:', error);
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
  }
}

/**
 * POST /api/user/settings/auto-execute
 * Toggle auto-execute on/off.
 *
 * Body: { enabled: boolean }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  // CSRF protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) return csrfResult.response;

  let body: { enabled: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json(
      { error: '"enabled" must be a boolean' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // If enabling, verify SnapTrade is connected
    if (body.enabled) {
      const snapCheck = await client.query(
        `SELECT snaptrade_user_id, snaptrade_user_secret, snaptrade_selected_account
         FROM users WHERE id = $1`,
        [userId]
      );

      const user = snapCheck.rows[0];
      if (
        !user?.snaptrade_user_id ||
        !user?.snaptrade_user_secret ||
        !user?.snaptrade_selected_account
      ) {
        return NextResponse.json(
          {
            error:
              'Cannot enable auto-execute without a connected SnapTrade broker and selected account.',
          },
          { status: 400 }
        );
      }
    }

    await client.query(
      `UPDATE users SET auto_execute_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [body.enabled, userId]
    );

    console.log(
      `[AutoExecute] User ${userId} ${body.enabled ? 'ENABLED' : 'DISABLED'} auto-execute`
    );

    return NextResponse.json({
      success: true,
      auto_execute_enabled: body.enabled,
    });
  } catch (error: unknown) {
    console.error('[AutoExecute] Failed to update setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  } finally {
    client.release();
  }
}
