import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOrCreateUser } from '@/lib/db/users';
import { createSession } from '@/lib/auth/session';
import {
  OAUTH_STATE_COOKIE,
  verifyOAuthStateToken,
} from '@/lib/auth/oauth-state';
import {
  enforceRateLimit,
  rateLimitExceededResponse,
} from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  throw new Error('DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be configured');
}
if (!process.env.DISCORD_GUILD_ID || !process.env.SINGULARITY_ROLE_ID) {
  throw new Error('DISCORD_GUILD_ID and SINGULARITY_ROLE_ID must be configured');
}

const DISCORD_CLIENT_ID: string = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET: string = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_GUILD_ID: string = process.env.DISCORD_GUILD_ID;
const SINGULARITY_ROLE_ID: string = process.env.SINGULARITY_ROLE_ID;

function redirectWithError(request: Request, errorCode: string): NextResponse {
  const origin = new URL(request.url).origin;
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || origin;
  return NextResponse.redirect(new URL(`/login?error=${errorCode}`, baseUrl));
}

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'discord_oauth_callback',
    limit: 20,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'discord_oauth_callback');
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return redirectWithError(request, 'no_code');
  }

  if (!state) {
    return redirectWithError(request, 'invalid_state');
  }

  const cookieStore = await cookies();
  const stateCookieValue = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (!stateCookieValue) {
    return redirectWithError(request, 'invalid_state');
  }

  const isValidState = await verifyOAuthStateToken(stateCookieValue, state);

  if (!isValidState) {
    // Best-effort clear of state cookie so a stale/invalid value doesn't stick around
    const res = redirectWithError(request, 'invalid_state');
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }

  try {
    const origin = new URL(request.url).origin;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/discord/callback`;

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new Error('Discord token response missing access_token');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userData = (await userResponse.json()) as {
      id: string;
      username: string;
      discriminator?: string;
      avatar?: string | null;
    };

    const fullUsername = userData.discriminator && userData.discriminator !== '0'
      ? `${userData.username}#${userData.discriminator}`
      : userData.username;

    const memberResponse = await fetch(
      `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      }
    );

    if (!memberResponse.ok) {
      return redirectWithError(request, 'not_in_server');
    }

    const memberData = (await memberResponse.json()) as { roles?: string[] };
    const userRoles = memberData.roles || [];

    if (!userRoles.includes(SINGULARITY_ROLE_ID)) {
      return redirectWithError(request, 'no_singularity_role');
    }

    // Store just the avatar hash, not the full URL
    // Frontend will build the URL when needed
    const avatarHash = userData.avatar || undefined;

    const dbUser = await getOrCreateUser(userData.id, fullUsername, avatarHash);

    const token = await createSession({
      discordId: userData.id,
      dbUserId: dbUser.id,
      username: fullUsername,
      avatar: avatarHash || null,
    });

    // Use BASE_URL for redirect to ensure correct domain
    const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || origin;
    const response = NextResponse.redirect(new URL('/', baseUrl));

    // IMPORTANT: set cookies on the response (not via cookies()) so they are reliably
    // included even on redirects.
    console.log('[CALLBACK] Setting session cookie on response, token preview:', token.substring(0, 30));
    response.cookies.set('meridian_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // Keep in sync with createSession() which currently issues 7d JWTs.
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // Clear OAuth state cookie now that the flow succeeded
    response.cookies.delete(OAUTH_STATE_COOKIE);

    return response;
  } catch (error: unknown) {
    console.error('Discord OAuth callback failed:', error);
    return redirectWithError(request, 'auth_failed');
  }
}
