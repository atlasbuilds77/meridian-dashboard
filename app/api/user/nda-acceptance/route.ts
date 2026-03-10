import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import pool from '@/lib/db/pool';

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query(
      'SELECT * FROM nda_acceptances WHERE user_id = $1',
      [userId]
    );

    return NextResponse.json({ accepted: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking NDA acceptance:', error);
    return NextResponse.json({ error: 'Failed to check NDA acceptance' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accepted } = await req.json();
    
    if (!accepted) {
      return NextResponse.json({ error: 'NDA must be accepted' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO nda_acceptances (user_id, accepted_at, ip_address)
       VALUES ($1, NOW(), $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown']
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error accepting NDA:', error);
    return NextResponse.json({ error: 'Failed to accept NDA' }, { status: 500 });
  }
}
