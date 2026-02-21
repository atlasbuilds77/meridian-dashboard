import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const ADMIN_DISCORD_IDS = (process.env.ADMIN_DISCORD_IDS || '326085846216343552')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

export async function GET(request: Request) {
  const sessionResult = await requireSession();

  const limiterResult = await enforceRateLimit({
    request,
    name: 'auth_session',
    limit: 120,
    windowMs: 60_000,
    userId: sessionResult.ok ? sessionResult.session.dbUserId : undefined,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'auth_session');
  }

  if (!sessionResult.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = sessionResult.session;
  const isAdmin = ADMIN_DISCORD_IDS.includes(session.discordId);

  return NextResponse.json({
    authenticated: true,
    isAdmin,
    user: {
      id: String(session.dbUserId),
      dbUserId: session.dbUserId,
      discordId: session.discordId,
      username: session.username,
      avatar: session.avatar,
    },
  });
}
