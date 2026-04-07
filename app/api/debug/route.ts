import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/api/require-auth';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint — admin-only.
 * Never expose cookie values or session previews, even to admins.
 */
export async function GET(request: NextRequest) {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  return NextResponse.json({
    hasCookie: request.cookies.has('meridian_session'),
    cookieNames: request.cookies.getAll().map(c => c.name),
    timestamp: new Date().toISOString(),
  });
}
