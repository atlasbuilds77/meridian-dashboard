import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/require-auth';
import { currentUserHasRole } from '@/lib/auth/check-discord-role';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const HELIOS_ROLE_ID = process.env.HELIOS_ROLE_ID ?? '';

/**
 * Lightweight endpoint that returns whether the current user has Helios access.
 * Used by the client to decide whether to show the Signals nav link.
 */
export async function GET(request: Request) {
  const sessionResult = await requireSession();
  if (!sessionResult.ok) {
    return NextResponse.json({ hasAccess: false });
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'helios_access_check',
    limit: 30,
    windowMs: 60_000,
    userId: sessionResult.session.dbUserId,
  });
  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'helios_access_check');
  }

  // If no HELIOS_ROLE_ID is configured, grant access to all authenticated users
  if (!HELIOS_ROLE_ID) {
    return NextResponse.json({ hasAccess: true });
  }

  const hasAccess = await currentUserHasRole(HELIOS_ROLE_ID);
  return NextResponse.json({ hasAccess });
}
