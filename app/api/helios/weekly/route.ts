import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/require-auth';
import { currentUserHasRole } from '@/lib/auth/check-discord-role';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const HELIOS_API = 'https://helios-px7f.onrender.com';
const HELIOS_WEBHOOK_KEY = process.env.HELIOS_WEBHOOK_KEY ?? '';
const HELIOS_ROLE_ID = process.env.HELIOS_ROLE_ID ?? '';

export async function GET(request: Request) {
  // --- auth ---
  const sessionResult = await requireSession();
  if (!sessionResult.ok) return sessionResult.response;

  const limiterResult = await enforceRateLimit({
    request,
    name: 'helios_weekly',
    limit: 60,
    windowMs: 60_000,
    userId: sessionResult.session.dbUserId,
  });
  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'helios_weekly');
  }

  // --- role gate ---
  if (HELIOS_ROLE_ID) {
    const hasRole = await currentUserHasRole(HELIOS_ROLE_ID);
    if (!hasRole) {
      return NextResponse.json({ error: 'Missing Helios access role' }, { status: 403 });
    }
  }

  // --- proxy to Helios ---
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (HELIOS_WEBHOOK_KEY) {
      headers['x-webhook-key'] = HELIOS_WEBHOOK_KEY;
    }

    const res = await fetch(`${HELIOS_API}/weekly`, {
      headers,
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[helios/weekly] upstream error', res.status, text);
      return NextResponse.json(
        { error: 'Helios API error', status: res.status },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[helios/weekly] fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to reach Helios API' },
      { status: 502 },
    );
  }
}
