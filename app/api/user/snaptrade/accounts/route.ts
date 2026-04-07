import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { getSnapTradeData } from '@/lib/db/snaptrade-users';
import { listAccounts, isConfigured } from '@/lib/snaptrade/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/snaptrade/accounts
 * 
 * Lists the user's connected brokerage accounts via SnapTrade.
 * Returns account IDs, names, and which one is currently selected.
 */
export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'SnapTrade is not configured' },
      { status: 503 }
    );
  }

  try {
    const snapData = await getSnapTradeData(userId);

    if (!snapData?.snaptrade_user_id || !snapData?.snaptrade_user_secret) {
      return NextResponse.json({
        connected: false,
        accounts: [],
        selectedAccount: null,
      });
    }

    const accounts = await listAccounts(
      snapData.snaptrade_user_id,
      snapData.snaptrade_user_secret
    );

    return NextResponse.json({
      connected: true,
      connectedAt: snapData.snaptrade_connected_at,
      selectedAccount: snapData.snaptrade_selected_account,
      accounts: accounts.map((acct: Record<string, unknown>) => ({
        id: acct.id,
        name: acct.name,
        number: acct.number,
        institution_name: acct.institution_name,
        sync_status: acct.sync_status,
        meta: acct.meta,
      })),
    });
  } catch (error: unknown) {
    console.error('[SnapTrade Accounts] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch accounts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
