import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { clearSnapTradeData } from '@/lib/db/snaptrade-users';
import { validateCsrfFromRequest } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/snaptrade/disconnect
 * 
 * Disconnects the user's SnapTrade account. Clears all SnapTrade
 * fields from the user record.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) return csrfResult.response;

  try {
    await clearSnapTradeData(authResult.userId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[SnapTrade Disconnect] Error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
