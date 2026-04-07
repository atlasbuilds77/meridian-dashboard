import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

function getOAuthSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(s);
}

export const OAUTH_STATE_COOKIE = 'meridian_oauth_state';
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

export async function createOAuthStateToken(state: string): Promise<string> {
  return new SignJWT({ state, type: 'oauth_state' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_STATE_TTL_SECONDS}s`)
    .sign(getOAuthSecret());
}

export async function verifyOAuthStateToken(token: string, expectedState: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getOAuthSecret());
    return (
      payload.type === 'oauth_state' &&
      typeof payload.state === 'string' &&
      payload.state === expectedState
    );
  } catch {
    return false;
  }
}
