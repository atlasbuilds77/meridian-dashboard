import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { applySecurityHeaders } from '@/lib/security/headers';
import { isAdminDiscordId, hasConfiguredAdminIds } from '@/lib/auth/admin';

const SESSION_SECRET = process.env.SESSION_SECRET;
const PUBLIC_ROUTES = ['/login', '/legal', '/api/auth/discord/callback', '/api/auth/discord/login'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

function withHeaders(response: NextResponse): NextResponse {
  return applySecurityHeaders(response);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api')) {
    return withHeaders(NextResponse.next());
  }

  if (isPublicRoute(pathname)) {
    return withHeaders(NextResponse.next());
  }

  const session = request.cookies.get('meridian_session');
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return withHeaders(NextResponse.redirect(loginUrl));
  }

  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    const loginUrl = new URL('/login?error=auth_config', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('meridian_session');
    return withHeaders(response);
  }

  try {
    const secret = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(session.value, secret);
    
    // Check if accessing admin routes
    if (pathname.startsWith('/admin')) {
      // Verify admin access
      const discordId = payload.discordId as string;
      
      if (!hasConfiguredAdminIds() || !isAdminDiscordId(discordId)) {
        // Not an admin, redirect to home or show access denied
        const homeUrl = new URL('/', request.url);
        return withHeaders(NextResponse.redirect(homeUrl));
      }
    }
    
    return withHeaders(NextResponse.next());
  } catch {
    const loginUrl = new URL('/login?error=session_expired', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('meridian_session');
    return withHeaders(response);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
