import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { setSystemAccount, type TradingSystem } from '@/lib/db/snaptrade-users';
import { validateCsrfFromRequest } from '@/lib/security/csrf';

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
