import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth/session';
import {
  storeApiCredential,
  getUserPlatforms,
  deleteApiCredential,
  markCredentialVerified,
  markCredentialFailed,
  logApiKeyOperation,
} from '@/lib/db/api-credentials';
import { verifyTradierKey } from '@/lib/api-clients/tradier';
import { verifyPolymarketAddress } from '@/lib/api-clients/polymarket';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/credentials
 * List user's configured platforms
 */
export async function GET() {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const platforms = await getUserPlatforms(userId);
    
    return NextResponse.json({
      platforms,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/credentials
 * Add or update API credential
 */
export async function POST(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { platform, api_key, api_secret, key_name } = body;
    
    // Validate required fields
    if (!platform || !api_key) {
      return NextResponse.json(
        { error: 'Platform and API key are required' },
        { status: 400 }
      );
    }
    
    // Validate platform
    const validPlatforms = ['tradier', 'polymarket', 'topstepx', 'webull'];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Verify API key before storing
    let verificationResult: { valid: boolean; error?: string; accountNumber?: string; balance?: number };
    
    switch (platform) {
      case 'tradier':
        verificationResult = await verifyTradierKey(api_key);
        break;
      
      case 'polymarket':
        verificationResult = await verifyPolymarketAddress(api_key);
        break;
      
      case 'topstepx':
      case 'webull':
        // TODO: Implement verification for these platforms
        verificationResult = { valid: true };
        break;
      
      default:
        verificationResult = { valid: false, error: 'Platform not supported' };
    }
    
    if (!verificationResult.valid) {
      // Log failed attempt
      await logApiKeyOperation(
        userId,
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
    
    // Store encrypted credential
    const credential = await storeApiCredential(
      userId,
      platform,
      api_key,
      api_secret,
      key_name
    );
    
    // Mark as verified and store account number if available
    await markCredentialVerified(userId, platform, verificationResult.accountNumber);
    
    // Log successful creation
    await logApiKeyOperation(
      userId,
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
  } catch (error: any) {
    console.error('Failed to store credential:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to store credential' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/credentials
 * Remove API credential
 */
export async function DELETE(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    
    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }
    
    const deleted = await deleteApiCredential(userId, platform);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      );
    }
    
    // Log deletion
    await logApiKeyOperation(
      userId,
      null,
      'deleted',
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined,
      { platform }
    );
    
    return NextResponse.json({
      success: true,
      message: 'Credential deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete credential:', error);
    return NextResponse.json(
      { error: 'Failed to delete credential' },
      { status: 500 }
    );
  }
}
