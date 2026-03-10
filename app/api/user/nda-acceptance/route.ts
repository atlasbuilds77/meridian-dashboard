import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { acceptedAt, version } = await req.json();

    const db = await getDb();
    const userIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await db.execute(
      `INSERT INTO nda_acceptances (user_id, accepted_at, nda_version, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, nda_version) DO UPDATE SET
         accepted_at = excluded.accepted_at,
         ip_address = excluded.ip_address,
         user_agent = excluded.user_agent`,
      [session.userId, acceptedAt, version, userIp, userAgent]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('NDA acceptance recording error:', error);
    return NextResponse.json(
      { error: 'Failed to record NDA acceptance' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const result = await db.execute(
      'SELECT accepted_at, nda_version FROM nda_acceptances WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 1',
      [session.userId]
    );

    const acceptance = result.rows[0];
    return NextResponse.json({
      hasAccepted: !!acceptance,
      acceptance: acceptance || null,
    });
  } catch (error) {
    console.error('NDA acceptance check error:', error);
    return NextResponse.json(
      { error: 'Failed to check NDA acceptance' },
      { status: 500 }
    );
  }
}
