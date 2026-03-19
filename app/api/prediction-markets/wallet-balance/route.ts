import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { getApiCredential } from '@/lib/db/api-credentials';

export const dynamic = 'force-dynamic';

// USDC contract on Polygon
const USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
// Conditional Tokens Framework (CTF) contract on Polygon (Polymarket uses this)
const CTF_EXCHANGE = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';

/**
 * Query USDC balance on Polygon via public RPC
 */
async function getPolygonUsdcBalance(walletAddress: string): Promise<number> {
  // ERC-20 balanceOf(address) selector = 0x70a08231
  const paddedAddress = walletAddress.slice(2).toLowerCase().padStart(64, '0');
  const data = `0x70a08231${paddedAddress}`;

  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        { to: USDC_CONTRACT, data },
        'latest',
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Polygon RPC error: ${response.status}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`);
  }

  // USDC has 6 decimals
  const rawBalance = BigInt(result.result || '0x0');
  return Number(rawBalance) / 1e6;
}

/**
 * Query MATIC balance for gas estimation
 */
async function getPolygonMaticBalance(walletAddress: string): Promise<number> {
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [walletAddress, 'latest'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Polygon RPC error: ${response.status}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`);
  }

  const rawBalance = BigInt(result.result || '0x0');
  return Number(rawBalance) / 1e18;
}

export async function GET(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'prediction_markets_wallet_balance',
    limit: 30,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'prediction_markets_wallet_balance');
  }

  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    // Get user's Polymarket wallet address from credentials
    const credential = await getApiCredential(authResult.userId, 'polymarket');

    if (!credential) {
      return NextResponse.json({
        connected: false,
        error: 'No Polymarket wallet connected',
        timestamp: new Date().toISOString(),
      });
    }

    const walletAddress = credential.api_key; // Stored as wallet address

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({
        connected: true,
        error: 'Invalid wallet address format',
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch USDC + MATIC balances in parallel
    const [usdcBalance, maticBalance] = await Promise.allSettled([
      getPolygonUsdcBalance(walletAddress),
      getPolygonMaticBalance(walletAddress),
    ]);

    const usdc = usdcBalance.status === 'fulfilled' ? usdcBalance.value : null;
    const matic = maticBalance.status === 'fulfilled' ? maticBalance.value : null;

    return NextResponse.json({
      connected: true,
      walletAddress,
      balances: {
        usdc,
        matic,
      },
      hasGas: matic !== null && matic > 0.01, // Need some MATIC for gas
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WalletBalance] Failed to fetch:', error);
    return NextResponse.json(
      {
        connected: true,
        error: 'Failed to fetch wallet balance',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
