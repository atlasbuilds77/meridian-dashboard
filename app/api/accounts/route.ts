import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated',
      message: 'Use /api/user/accounts for authenticated account data.',
      deprecated: true,
    },
    { status: 410 }
  );
}
