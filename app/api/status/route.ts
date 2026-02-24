import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SystemStatus = {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  lastUpdate: string | null;
};

async function checkService(name: string, url: string): Promise<SystemStatus> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    return {
      name,
      status: response.ok ? 'online' : 'degraded',
      lastUpdate: new Date().toISOString(),
    };
  } catch {
    return {
      name,
      status: 'offline',
      lastUpdate: null,
    };
  }
}

async function checkMeridian(): Promise<SystemStatus> {
  const meridianHealthUrl = process.env.MERIDIAN_HEALTHCHECK_URL;
  if (!meridianHealthUrl) {
    return {
      name: 'Meridian',
      status: 'degraded',
      lastUpdate: null,
    };
  }

  return checkService('Meridian', meridianHealthUrl);
}

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'system_status',
    limit: 120,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'system_status');
  }

  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const [meridian, helios, nebula] = await Promise.all([
      checkMeridian(),
      checkService('Helios', 'https://helios-px7f.onrender.com/health'),
      checkService('Nebula', 'https://nebula.zerogtrading.com/api/futures/prices?symbol=ES'),
    ]);

    const systems = { meridian, helios, nebula };
    const allOnline = Object.values(systems).every((system) => system.status === 'online');
    const anyOffline = Object.values(systems).some((system) => system.status === 'offline');

    const overall: 'healthy' | 'degraded' | 'error' = allOnline
      ? 'healthy'
      : anyOffline
      ? 'error'
      : 'degraded';

    return NextResponse.json({
      overall,
      systems,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Status check error:', error);
    return NextResponse.json(
      {
        overall: 'error',
        systems: {
          meridian: { name: 'Meridian', status: 'offline', lastUpdate: null },
          helios: { name: 'Helios', status: 'offline', lastUpdate: null },
          nebula: { name: 'Nebula', status: 'offline', lastUpdate: null },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
