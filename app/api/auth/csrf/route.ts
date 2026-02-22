/**
 * CSRF Token Endpoint
 * 
 * GET /api/auth/csrf - Returns a CSRF token for the current session
 * Frontend should call this before making state-changing requests
 */

import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import { generateCsrfToken } from '@/lib/security/csrf';

export async function GET() {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const token = generateCsrfToken(userId);
  
  return NextResponse.json({
    token,
    expiresIn: 3600, // 1 hour in seconds
  });
}
