import { NextResponse } from 'next/server';
import { getSession, getUserIdFromSession, type SessionPayload } from '@/lib/auth/session';

const fallbackAdminIds = ['326085846216343552'];
const configuredAdminIds = (process.env.ADMIN_DISCORD_IDS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const ADMIN_DISCORD_IDS = configuredAdminIds.length > 0 ? configuredAdminIds : fallbackAdminIds;

export type UserAuthResult =
  | { ok: true; userId: number }
  | { ok: false; response: NextResponse };

export type SessionAuthResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

export type AdminAuthResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function requireUserId(): Promise<UserAuthResult> {
  const userId = await getUserIdFromSession();

  if (!userId) {
    return { ok: false, response: unauthorizedResponse() };
  }

  return { ok: true, userId };
}

export async function requireSession(): Promise<SessionAuthResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, response: unauthorizedResponse() };
  }

  return { ok: true, session };
}

export async function requireAdminSession(): Promise<AdminAuthResult> {
  const sessionResult = await requireSession();

  if (!sessionResult.ok) {
    return sessionResult;
  }

  if (!ADMIN_DISCORD_IDS.includes(sessionResult.session.discordId)) {
    return { ok: false, response: forbiddenResponse() };
  }

  return { ok: true, session: sessionResult.session };
}
