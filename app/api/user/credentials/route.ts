import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  storeApiCredential,
  getUserPlatforms,
  deleteApiCredential,
  markCredentialFailed,
  markCredentialVerified,
  logApiKeyOperation,
} from '@/lib/db/api-credentials';
import { verifyTradierKey } from '@/lib/api-clients/tradier';
import { verifyPolymarketAddress } from '@/lib/api-clients/polymarket';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const platforms = ['tradier', 'polymarket', 'topstepx', 'webull'] as const;

const createCredentialSchema = z.object({
  platform: z.enum(platforms),
  api_key: z.string().min(1),
  api_secret: z.string().optional(),
  key_name: z.string().max(100).optional(),
});

export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const platformsList = await getUserPlatforms(authResult.userId);
    return NextResponse.json({
      platforms: platformsList,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch credentials:', error);
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_credentials_write',
    limit: 20,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_credentials_write');
  }

  try {
    const body = await request.json();
    const parsed = createCredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const { platform, api_key, api_secret, key_name } = parsed.data;

    let verificationResult: {
      valid: boolean;
      error?: string;
      accountNumber?: string;
      balance?: number;
    };

    switch (platform) {
      case 'tradier':
        verificationResult = await verifyTradierKey(api_key);
        break;
      case 'polymarket':
        verificationResult = await verifyPolymarketAddress(api_key);
        break;
      case 'topstepx':
      case 'webull':
        verificationResult = { valid: true };
        break;
      default:
        verificationResult = { valid: false, error: 'Unsupported platform' };
    }

    if (!verificationResult.valid) {
      await markCredentialFailed(authResult.userId, platform, verificationResult.error || 'Verification failed');

      await logApiKeyOperation(
        authResult.userId,
        null,
        'verification_failed',
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined,
        { platform, error: verificationResult.error }
      );

      return NextResponse.json(
        { error: verificationResult.error || 'API key verification failed' },
        { status: 400 }
      );
    }

    const credential = await storeApiCredential(
      authResult.userId,
      platform,
      api_key,
      api_secret,
      key_name
    );

    await markCredentialVerified(authResult.userId, platform, verificationResult.accountNumber);

    await logApiKeyOperation(
      authResult.userId,
      credential.id,
      'created',
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined,
      { platform, verified: true }
    );

    return NextResponse.json({
      success: true,
      credential: {
        id: credential.id,
        platform: credential.platform,
        key_name: credential.key_name,
        verification_status: 'verified',
        created_at: credential.created_at,
      },
      verification: {
        account_number: verificationResult.accountNumber,
        balance: verificationResult.balance,
      },
    });
  } catch (error) {
    console.error('Failed to store credential:', error);
    return NextResponse.json({ error: 'Failed to store credential' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'user_credentials_write',
    limit: 20,
    windowMs: 60_000,
    userId: authResult.userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'user_credentials_write');
  }

  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    if (!platform || !platforms.includes(platform as (typeof platforms)[number])) {
      return NextResponse.json(
        { error: `Platform is required (${platforms.join(', ')})` },
        { status: 400 }
      );
    }

    const deleted = await deleteApiCredential(authResult.userId, platform);

    if (!deleted) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    await logApiKeyOperation(
      authResult.userId,
      null,
      'deleted',
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined,
      { platform }
    );

    return NextResponse.json({ success: true, message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Failed to delete credential:', error);
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 });
  }
}
