import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { setSnapTradeSelectedAccount } from '@/lib/db/snaptrade-users';
import { validateCsrfFromRequest } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/snaptrade/select-account
 * 
 * Sets the user's selected SnapTrade account for trade execution.
 * Body: { accountId: string }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) return csrfResult.response;

  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    await setSnapTradeSelectedAccount(authResult.userId, accountId);

    return NextResponse.json({ success: true, selectedAccount: accountId });
  } catch (error: unknown) {
    console.error('[SnapTrade Select Account] Error:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}
