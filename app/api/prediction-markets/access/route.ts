import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/require-auth';
import { currentUserHasRole } from '@/lib/auth/check-discord-role';
import { isAdminDiscordId } from '@/lib/auth/admin';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const PREDICTION_MARKETS_ROLE_ID = process.env.PREDICTION_MARKETS_ROLE_ID ?? '';

export async function GET(request: Request) {
  const sessionResult = await requireSession();
  if (!sessionResult.ok) {
    return NextResponse.json({ hasAccess: false });
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'prediction_markets_access_check',
    limit: 30,
    windowMs: 60_000,
    userId: sessionResult.session.dbUserId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'prediction_markets_access_check');
  }

  if (await isAdminDiscordId(sessionResult.session.discordId)) {
    return NextResponse.json({ hasAccess: true });
  }

  // If no role is configured yet, keep prediction markets available to authenticated users.
  if (!PREDICTION_MARKETS_ROLE_ID) {
    return NextResponse.json({ hasAccess: true });
  }

  const hasAccess = await currentUserHasRole(PREDICTION_MARKETS_ROLE_ID);
  return NextResponse.json({ hasAccess });
}
