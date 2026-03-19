import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { validateCsrfFromRequest } from '@/lib/security/csrf';
import {
  getUsersWithPolymarketWallets,
  createPosition,
  updateExecutionStatus,
  logExecution,
} from '@/lib/db/copy-trade-positions';
import { getApiCredential } from '@/lib/db/api-credentials';

export const dynamic = 'force-dynamic';

const executeTradeSchema = z.object({
  bot: z.enum(['oracle', 'nightwatch']),
  // Market info
  marketId: z.string().optional(),
  tokenId: z.string().optional(),
  asset: z.string().optional(),
  question: z.string().optional(),
  marketType: z.string().optional(),
  // Trade details
  direction: z.string(), // UP/DOWN or BUY/SELL
  side: z.enum(['BUY', 'SELL']),
  price: z.number().min(0.001).max(0.999),
  stakeUsd: z.number().min(0.5).max(100), // Cap at $100 per trade during beta
  // Reference to source signal
  sourceTradeId: z.string().optional(),
  // Paper mode override
  dryRun: z.boolean().optional(),
});

interface ExecutionResult {
  userId: number;
  username: string;
  walletAddress: string;
  positionId: number;
  status: 'success' | 'failed' | 'dry_run';
  orderId?: string;
  error?: string;
}

/**
 * Execute a trade on Polymarket via CLOB API
 * For now: logs the position (paper mode).
 * When ready: calls py-clob-client or direct CLOB API.
 */
async function executeClobTrade(params: {
  walletAddress: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  dryRun: boolean;
}): Promise<{ success: boolean; orderId?: string; error?: string }> {
  // PHASE 1: Paper trading mode — record but don't execute
  // When going live, this is where py-clob-client integration goes.
  //
  // To go live:
  // 1. Each user needs to generate Polymarket API credentials (key, secret, passphrase)
  //    via the Polymarket CLOB API using their private key
  // 2. Store those credentials encrypted alongside their wallet address
  // 3. Use py-clob-client or direct CLOB REST to place limit orders
  //
  // For now, we record everything as dry_run and generate simulated order IDs.

  if (params.dryRun) {
    const simulatedOrderId = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return { success: true, orderId: simulatedOrderId };
  }

  // LIVE EXECUTION (Phase 2 — disabled until API creds are wired)
  // const clobUrl = 'https://clob.polymarket.com';
  // const orderPayload = {
  //   token_id: params.tokenId,
  //   side: params.side,
  //   price: params.price.toString(),
  //   size: params.size.toString(),
  //   type: 'limit',
  //   // Requires user's CLOB API credentials for signing
  // };
  // const response = await fetch(`${clobUrl}/order`, { ... });

  // For now, just simulate
  const simulatedOrderId = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { success: true, orderId: simulatedOrderId };
}

export async function POST(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'prediction_markets_execute_trade',
    limit: 10,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'prediction_markets_execute_trade');
  }

  // Admin-only endpoint — only bots/admins should trigger copy-trades
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  // CSRF protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  try {
    const body = await request.json();
    const parsed = executeTradeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid trade payload' },
        { status: 400 }
      );
    }

    const trade = parsed.data;
    const isDryRun = trade.dryRun !== false; // Default to dry_run during beta

    // Get all users with connected Polymarket wallets
    const users = await getUsersWithPolymarketWallets();

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with connected wallets',
        results: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Cap at 4 users during beta
    const targetUsers = users.slice(0, 4);

    console.log(`[CopyTrade] Executing ${trade.bot} signal for ${targetUsers.length} users`, {
      bot: trade.bot,
      side: trade.side,
      price: trade.price,
      stakeUsd: trade.stakeUsd,
      dryRun: isDryRun,
      userCount: targetUsers.length,
    });

    // Execute for each user
    const results: ExecutionResult[] = [];

    for (const user of targetUsers) {
      try {
        // Calculate shares from stake and price
        const shares = trade.stakeUsd / trade.price;

        // Create position record first
        const position = await createPosition({
          userId: user.userId,
          bot: trade.bot,
          marketId: trade.marketId,
          tokenId: trade.tokenId,
          asset: trade.asset,
          question: trade.question,
          marketType: trade.marketType,
          direction: trade.direction,
          side: trade.side,
          shares,
          entryPrice: trade.price,
          stakeUsd: trade.stakeUsd,
          dryRun: isDryRun,
          sourceTradeId: trade.sourceTradeId,
          executionStatus: 'pending',
        });

        // Execute the trade
        const execResult = await executeClobTrade({
          walletAddress: user.walletAddress,
          tokenId: trade.tokenId || '',
          side: trade.side,
          price: trade.price,
          size: shares,
          dryRun: isDryRun,
        });

        if (execResult.success) {
          await updateExecutionStatus(
            position.id,
            isDryRun ? 'filled' : 'submitted',
            execResult.orderId
          );

          await logExecution(user.userId, position.id, trade.bot, 'execute', {
            side: trade.side,
            price: trade.price,
            shares,
            stakeUsd: trade.stakeUsd,
            orderId: execResult.orderId,
            dryRun: isDryRun,
          });

          results.push({
            userId: user.userId,
            username: user.username,
            walletAddress: user.walletAddress,
            positionId: position.id,
            status: isDryRun ? 'dry_run' : 'success',
            orderId: execResult.orderId,
          });
        } else {
          await updateExecutionStatus(position.id, 'failed', undefined, execResult.error);

          await logExecution(user.userId, position.id, trade.bot, 'error', {
            error: execResult.error,
          });

          results.push({
            userId: user.userId,
            username: user.username,
            walletAddress: user.walletAddress,
            positionId: position.id,
            status: 'failed',
            error: execResult.error,
          });
        }
      } catch (error) {
        console.error(`[CopyTrade] Failed for user ${user.userId}:`, error);

        await logExecution(user.userId, null, trade.bot, 'error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        results.push({
          userId: user.userId,
          username: user.username,
          walletAddress: user.walletAddress,
          positionId: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Trade execution failed',
        });
      }
    }

    const succeeded = results.filter((r) => r.status !== 'failed').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    console.log(`[CopyTrade] Complete: ${succeeded} success, ${failed} failed`, {
      bot: trade.bot,
      dryRun: isDryRun,
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: targetUsers.length,
        succeeded,
        failed,
        dryRun: isDryRun,
      },
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CopyTrade] Execute trade error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute copy-trade',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
