import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const reqCookie = request.cookies.get('meridian_session');
  const cookieStore = await cookies();
  const storeCookie = cookieStore.get('meridian_session');
  
  return NextResponse.json({
    fromRequest: reqCookie ? { exists: true, preview: reqCookie.value.substring(0, 30) } : null,
    fromCookieStore: storeCookie ? { exists: true, preview: storeCookie.value.substring(0, 30) } : null,
    allRequestCookies: request.cookies.getAll().map(c => c.name),
    timestamp: new Date().toISOString(),
  });
}
