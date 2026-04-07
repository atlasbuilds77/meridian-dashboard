import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { validateCsrfFromRequest } from '@/lib/security/csrf';
import {
  getAutoExecuteStatus,
  setAutoExecuteForSystem,
  getSnapTradeData,
  type TradingSystem,
} from '@/lib/db/snaptrade-users';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

const VALID_SYSTEMS: TradingSystem[] = ['helios', 'meridian'];

/**
 * GET /api/user/settings/auto-execute
 * Returns per-system auto-execute status for the logged-in user.
 * Also returns legacy auto_execute_enabled for backward compat.
 */
export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  try {
    const status = await getAutoExecuteStatus(userId);

    // Legacy compat: auto_execute_enabled = true if either system is enabled
    const legacyEnabled = status.helios || status.meridian;

    return NextResponse.json({
      auto_execute_enabled: legacyEnabled,
      helios_auto_execute_enabled: status.helios,
      meridian_auto_execute_enabled: status.meridian,
    });
  } catch (error: unknown) {
    console.error('[AutoExecute] Failed to fetch setting:', error);
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 });
  }
}

/**
 * POST /api/user/settings/auto-execute
 * Toggle auto-execute on/off for a specific system.
 *
 * Body: { system: 'helios' | 'meridian', enabled: boolean }
 *   OR legacy: { enabled: boolean } (applies to both)
 */
export async function POST(request: NextRequest) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  // CSRF protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) return csrfResult.response;

  let body: { system?: string; enabled: boolean };
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

  // Determine which system(s) to update
  const systems: TradingSystem[] = body.system && VALID_SYSTEMS.includes(body.system as TradingSystem)
    ? [body.system as TradingSystem]
    : ['helios', 'meridian']; // Legacy: apply to both

  const client = await pool.connect();
  try {
    // If enabling, verify SnapTrade is connected with the correct system account
    if (body.enabled) {
      const snapData = await getSnapTradeData(userId);

      if (!snapData?.snaptrade_user_id || !snapData?.snaptrade_user_secret) {
        return NextResponse.json(
          { error: 'Cannot enable auto-execute without a connected SnapTrade broker.' },
          { status: 400 }
        );
      }

      for (const sys of systems) {
        const accountCol = sys === 'helios' ? 'helios_snaptrade_account' : 'meridian_snaptrade_account';
        const accountId = snapData[accountCol as keyof typeof snapData];
        if (!accountId) {
          return NextResponse.json(
            {
              error: `Cannot enable auto-execute for ${sys.charAt(0).toUpperCase() + sys.slice(1)} without selecting a broker account for it.`,
            },
            { status: 400 }
          );
        }
      }
    }

    for (const sys of systems) {
      await setAutoExecuteForSystem(userId, sys, body.enabled);
    }

    // Also update legacy column for backward compat
    const newStatus = await getAutoExecuteStatus(userId);
    await client.query(
      `UPDATE users SET auto_execute_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newStatus.helios || newStatus.meridian, userId]
    );

    const systemLabel = systems.length === 1 ? systems[0] : 'all systems';
    console.log(
      `[AutoExecute] User ${userId} ${body.enabled ? 'ENABLED' : 'DISABLED'} auto-execute for ${systemLabel}`
    );

    return NextResponse.json({
      success: true,
      auto_execute_enabled: newStatus.helios || newStatus.meridian,
      helios_auto_execute_enabled: newStatus.helios,
      meridian_auto_execute_enabled: newStatus.meridian,
    });
  } catch (error: unknown) {
    console.error('[AutoExecute] Failed to update setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  } finally {
    client.release();
  }
}
