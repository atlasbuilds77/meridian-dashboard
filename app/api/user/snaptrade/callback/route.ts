import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import { setSnapTradeConnected } from '@/lib/db/snaptrade-users';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/snaptrade/callback
 * 
 * Handles the redirect back from SnapTrade Connection Portal.
 * SnapTrade redirects here after the user connects a brokerage account.
 * We mark the user as connected and redirect to settings.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // SUCCESS, ERROR, etc.

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';

  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      // User not logged in — redirect to login
      return NextResponse.redirect(`${baseUrl}/settings?snaptrade=auth_error`);
    }

    if (status === 'SUCCESS' || !status) {
      // Mark user as connected
      await setSnapTradeConnected(userId);

      return NextResponse.redirect(`${baseUrl}/settings?snaptrade=connected`);
    }

    // Connection failed or was cancelled
    console.warn(`[SnapTrade Callback] Non-success status: ${status} for user ${userId}`);
    return NextResponse.redirect(`${baseUrl}/settings?snaptrade=error&reason=${encodeURIComponent(status || 'unknown')}`);
  } catch (error) {
    console.error('[SnapTrade Callback] Error:', error);
    return NextResponse.redirect(`${baseUrl}/settings?snaptrade=error`);
  }
}
