import { NextResponse } from 'next/server';
import {
  createOAuthStateToken,
  generateOAuthState,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
} from '@/lib/auth/oauth-state';
import { getPublicOrigin } from '@/lib/url/origin';

export const dynamic = 'force-dynamic';

function getDiscordClientId(): string {
  const id = process.env.DISCORD_CLIENT_ID;
  if (!id) {
    throw new Error('DISCORD_CLIENT_ID must be configured');
  }
  return id;
}

export async function GET(request: Request) {
  const origin = await getPublicOrigin(request);
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/discord/callback`;

  const state = generateOAuthState();
  const signedState = await createOAuthStateToken(state);

  const params = new URLSearchParams({
    client_id: getDiscordClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
    state,
  });

  const response = NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?${params.toString()}`
  );

  response.cookies.set(OAUTH_STATE_COOKIE, signedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: OAUTH_STATE_TTL_SECONDS,
    path: '/',
  });

  return response;
}
