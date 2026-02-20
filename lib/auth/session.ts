import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

const secret = new TextEncoder().encode(SESSION_SECRET);

export interface SessionPayload {
  discordId: string;
  dbUserId: number;
  username: string;
  avatar: string | null;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, authorized: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h') // Reduced from 7 days
    .sign(secret);
}

export async function getUserIdFromSession(): Promise<number | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('meridian_session');
  
  if (!session) return null;
  
  try {
    const { payload } = await jwtVerify(session.value, secret);
    return payload.dbUserId as number;
  } catch {
    return null; // Invalid/tampered token
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('meridian_session');
  
  if (!session) return null;
  
  try {
    const { payload } = await jwtVerify(session.value, secret);
    return {
      discordId: payload.discordId as string,
      dbUserId: payload.dbUserId as number,
      username: payload.username as string,
      avatar: payload.avatar as string | null,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('meridian_session');
}
