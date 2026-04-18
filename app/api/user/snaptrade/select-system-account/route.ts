import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { setSystemAccount, type TradingSystem } from '@/lib/db/snaptrade-users';
import { validateCsrfFromRequest } from '@/lib/security/csrf';
import { listAccounts } from '@/lib/snaptrade/client';
import { getSnapTradeData } from '@/lib/db/snaptrade-users';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

const VALID_SYSTEMS: TradingSystem[] = ['helios', 'meridian'];

/**
 * POST /api/user/snaptrade/select-system-account
 *
 * Sets the user's SnapTrade account for a specific trading system.
 * Body: { system: 'helios' | 'meridian', accountId: string }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) return csrfResult.response;

  try {
    const body = await request.json();
    const { system, accountId } = body;

    if (!system || !VALID_SYSTEMS.includes(system)) {
      return NextResponse.json(
        { error: 'system must be "helios" or "meridian"' },
        { status: 400 }
      );
    }

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    await setSystemAccount(authResult.userId, system as TradingSystem, accountId);

    // Save brokerage_name so the webhook can route symbols correctly per broker
    try {
      const snapData = await getSnapTradeData(authResult.userId);
      if (snapData?.snaptrade_user_id && snapData?.snaptrade_user_secret) {
        const accounts = await listAccounts(snapData.snaptrade_user_id, snapData.snaptrade_user_secret);
        const selected = accounts.find((a: { id: string }) => a.id === accountId);
        const brokerageName = (selected as { institution_name?: string })?.institution_name || null;
        if (brokerageName) {
          await pool.query('UPDATE users SET brokerage_name = $1 WHERE id = $2', [brokerageName, authResult.userId]);
          console.log(`[SelectAccount] Saved brokerage_name=${brokerageName} for user ${authResult.userId}`);
        }
      }
    } catch (brokerErr) {
      console.warn('[SelectAccount] Could not save brokerage_name:', brokerErr);
    }

    return NextResponse.json({
      success: true,
      system,
      accountId,
    });
  } catch (error: unknown) {
    console.error('[SnapTrade Select System Account] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update system account' },
      { status: 500 }
    );
  }
}
