import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth'];
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Get session cookie
  const session = request.cookies.get('meridian_session');

  // If no session, redirect to login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT session
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    await jwtVerify(session.value, secret);
    
    // JWT is valid, continue
    return NextResponse.next();
  } catch (error) {
    // Invalid or expired JWT, redirect to login
    const loginUrl = new URL('/login?error=session_expired', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('meridian_session');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|api/auth).*)',
  ],
};
