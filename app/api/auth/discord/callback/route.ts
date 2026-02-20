import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOrCreateUser } from '@/lib/db/users';
import { createSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// FAIL FAST - Required env vars
if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  throw new Error('DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be configured');
}
if (!process.env.DISCORD_GUILD_ID || !process.env.SINGULARITY_ROLE_ID) {
  throw new Error('DISCORD_GUILD_ID and SINGULARITY_ROLE_ID must be configured');
}

// Now we know these are defined
const DISCORD_CLIENT_ID: string = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET: string = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/discord/callback';
const DISCORD_GUILD_ID: string = process.env.DISCORD_GUILD_ID;
const SINGULARITY_ROLE_ID: string = process.env.SINGULARITY_ROLE_ID;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  try {
    // Exchange code for access token
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
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userData = await userResponse.json();
    const { id, username, discriminator, avatar } = userData;
    
    const fullUsername = discriminator && discriminator !== '0' 
      ? `${username}#${discriminator}` 
      : username;

    // Check guild membership and Singularity role (MANDATORY)
    try {
      // Get user's guild member info
      const memberResponse = await fetch(
        `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      if (!memberResponse.ok) {
        // User is not in the guild
        return NextResponse.redirect(new URL('/login?error=not_in_server', request.url));
      }

      const memberData = await memberResponse.json();
      const userRoles = memberData.roles || [];

      // Check if user has Singularity role
      if (!userRoles.includes(SINGULARITY_ROLE_ID)) {
        return NextResponse.redirect(new URL('/login?error=no_singularity_role', request.url));
      }
    } catch (error) {
      console.error('Guild membership check failed:', error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    // Get or create user in database
    const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : undefined;
    const dbUser = await getOrCreateUser(id, fullUsername, avatarUrl);

    // Create signed JWT session (24h expiry)
    const token = await createSession({
      discordId: id,
      dbUserId: dbUser.id,
      username: fullUsername,
      avatar: avatarUrl || null,
    });

    const cookieStore = await cookies();
    cookieStore.set('meridian_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours (matches JWT expiry)
      path: '/',
    });

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Discord OAuth error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
