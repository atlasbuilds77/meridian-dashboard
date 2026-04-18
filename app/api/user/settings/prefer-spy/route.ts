import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { validateCsrfFromRequest } from '@/lib/security/csrf';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const result = await pool.query(
    'SELECT prefer_spy FROM users WHERE id = $1',
    [authResult.userId]
  );
  return NextResponse.json({ prefer_spy: result.rows[0]?.prefer_spy ?? false });
}

export async function POST(request: NextRequest) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) return csrfResult.response;

  const body = await request.json();
  if (typeof body.prefer_spy !== 'boolean') {
    return NextResponse.json({ error: 'prefer_spy must be boolean' }, { status: 400 });
  }

  await pool.query(
    'UPDATE users SET prefer_spy = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [body.prefer_spy, authResult.userId]
  );

  console.log(`[PreferSPY] user=${authResult.userId} prefer_spy=${body.prefer_spy}`);
  return NextResponse.json({ success: true, prefer_spy: body.prefer_spy });
}
