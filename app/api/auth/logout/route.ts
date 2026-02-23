import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  await destroySession();
  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  await destroySession();
  const origin = new URL(request.url).origin;
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || origin;
  return NextResponse.redirect(new URL('/login', baseUrl));
}
