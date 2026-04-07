import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { getSnapTradeData, setSnapTradeRegistration } from '@/lib/db/snaptrade-users';
import { registerUser, getConnectionUrl, isConfigured } from '@/lib/snaptrade/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/snaptrade/connect
 * 
 * Generates a SnapTrade Connection Portal URL for the user.
 * If the user hasn't been registered with SnapTrade yet, registers them first.
 * Returns { redirectUrl } for the frontend to redirect to.
 */
export async function POST() {
  // Auth check
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  // Check SnapTrade is configured
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'SnapTrade is not configured on this server' },
      { status: 503 }
    );
  }

  try {
    let snapData = await getSnapTradeData(userId);

    // Register user with SnapTrade if not already registered
    if (!snapData?.snaptrade_user_id || !snapData?.snaptrade_user_secret) {
      const snapUserId = `meridian-${userId}`;
      const registration = await registerUser(snapUserId);

      await setSnapTradeRegistration(
        userId,
        registration.userId!,
        registration.userSecret!
      );

      snapData = {
        snaptrade_user_id: registration.userId!,
        snaptrade_user_secret: registration.userSecret!,
        snaptrade_selected_account: null,
        snaptrade_connected_at: null,
      };
    }

    // Build callback URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
    const callbackUrl = `${baseUrl}/api/user/snaptrade/callback`;

    // Get connection portal URL
    const loginResponse = await getConnectionUrl(
      snapData.snaptrade_user_id!,
      snapData.snaptrade_user_secret!,
      callbackUrl
    );

    // The SDK returns a union type; narrow to LoginRedirectURI
    const redirectUrl = 'redirectURI' in loginResponse
      ? loginResponse.redirectURI
      : null;

    if (!redirectUrl) {
      return NextResponse.json(
        { error: 'Failed to get redirect URL from SnapTrade' },
        { status: 502 }
      );
    }

    return NextResponse.json({ redirectUrl });
  } catch (error: unknown) {
    console.error('[SnapTrade Connect] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate connection URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
