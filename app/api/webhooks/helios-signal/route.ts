import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import pool from '@/lib/db/pool';
import { placeOrder, isConfigured } from '@/lib/snaptrade/client';

export const dynamic = 'force-dynamic';

// Rate limiter: max 10 requests per 60 seconds
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitMap.set(key, recent);
  return false;
}

interface HeliosSignalPayload {
  signal_id: string;
  ticker: string;
  action: 'buy' | 'sell';
  contract_symbol?: string;
  option_type?: string;
  strike?: number;
  expiration?: string;
  qty: number;
  price?: number;
  reason?: string;
  timestamp: string;
  secret: string;
}

/**
 * POST /api/webhooks/helios-signal
 *
 * Receives a signal from Helios and fans out execution
 * to all users who have:
 *   1. auto_execute_enabled = true
 *   2. A connected SnapTrade broker (snaptrade_user_id + snaptrade_user_secret + snaptrade_selected_account)
 *
 * Security:
 *   - Verifies HELIOS_WEBHOOK_SECRET
 *   - Rate limited to 10 req/min
 *   - All executions logged for audit trail
 */
export async function POST(request: NextRequest) {
  // --- Rate limiting ---
  const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: 'Rate limited. Max 10 signals per minute.' },
      { status: 429 }
    );
  }

  // --- Verify webhook secret ---
  const expectedSecret = process.env.HELIOS_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('[HeliosWebhook] HELIOS_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 503 }
    );
  }

  let body: HeliosSignalPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    !body.secret ||
    typeof body.secret !== 'string' ||
    body.secret.length !== expectedSecret.length ||
    !timingSafeEqual(Buffer.from(body.secret, 'utf8'), Buffer.from(expectedSecret, 'utf8'))
  ) {
    console.warn('[HeliosWebhook] Invalid secret from', clientIp);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Validate required fields ---
  if (!body.signal_id || !body.ticker || !body.action) {
    return NextResponse.json(
      { error: 'Missing required fields: signal_id, ticker, action' },
      { status: 400 }
    );
  }

  if (typeof body.signal_id !== 'string' || body.signal_id.length > 200) {
    return NextResponse.json({ error: 'Invalid signal_id' }, { status: 400 });
  }

  if (typeof body.ticker !== 'string' || body.ticker.length > 50) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
  }

  if (!['buy', 'sell'].includes(String(body.action).toLowerCase())) {
    return NextResponse.json(
      { error: 'action must be "buy" or "sell"' },
      { status: 400 }
    );
  }

  if (body.qty !== undefined && (typeof body.qty !== 'number' || body.qty <= 0 || body.qty > 10000 || !Number.isFinite(body.qty))) {
    return NextResponse.json({ error: 'Invalid qty' }, { status: 400 });
  }

  // --- Check SnapTrade configured on server ---
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'SnapTrade not configured on server' },
      { status: 503 }
    );
  }

  const client = await pool.connect();
  try {
    // --- Find all users with Helios auto-execute enabled AND SnapTrade connected ---
    const usersResult = await client.query(
      `SELECT
         u.id,
         u.username,
         u.snaptrade_user_id,
         u.snaptrade_user_secret,
         u.helios_snaptrade_account as snaptrade_selected_account,
         COALESCE(uts.size_pct, 1.0) as size_pct
       FROM users u
       LEFT JOIN user_trading_settings uts ON uts.user_id = u.id
       WHERE COALESCE(u.helios_auto_execute_enabled, u.auto_execute_enabled) = true
         AND u.snaptrade_user_id IS NOT NULL
         AND u.snaptrade_user_secret IS NOT NULL
         AND u.helios_snaptrade_account IS NOT NULL`
    );

    const eligibleUsers = usersResult.rows;

    if (eligibleUsers.length === 0) {
      console.log('[HeliosWebhook] No eligible users for auto-execute');
      // Still log the signal even if no one is eligible
      await logAutoExecution(client, {
        signal_id: body.signal_id,
        ticker: body.ticker,
        action: body.action,
        contract_symbol: body.contract_symbol || null,
        user_id: null,
        username: null,
        status: 'no_eligible_users',
        details: 'No users with auto_execute_enabled + SnapTrade connected',
      });
      return NextResponse.json({ success: true, executions: 0, message: 'No eligible users' });
    }

    console.log(
      `[HeliosWebhook] Executing ${body.action} ${body.ticker} for ${eligibleUsers.length} user(s)`
    );

    // --- Fan out execution to each user ---
    const results: Array<{
      userId: number;
      username: string;
      status: string;
      orderId?: string;
      error?: string;
    }> = [];

    for (const user of eligibleUsers) {
      try {
        // Determine SnapTrade action
        const isOption = !!(body.contract_symbol || body.option_type);
        let snapAction: 'BUY' | 'SELL' | 'BUY_TO_OPEN' | 'SELL_TO_CLOSE';
        if (isOption) {
          snapAction = body.action.toLowerCase() === 'buy' ? 'BUY_TO_OPEN' : 'SELL_TO_CLOSE';
        } else {
          snapAction = body.action.toUpperCase() as 'BUY' | 'SELL';
        }

        // Use contract_symbol for options, ticker for equities
        // SnapTrade requires exactly 21-character OCC format: TTTTTTYYMMDDXSSSSSSSS
        // where T=ticker padded to 6 chars, YYMMDD=expiry, X=C/P, S=strike*1000 padded to 8 digits
        let tradingSymbol = isOption && body.contract_symbol
          ? body.contract_symbol
          : body.ticker;
        if (isOption && tradingSymbol && tradingSymbol.length < 21) {
          // Extract parts and rebuild with proper padding
          // Try to pad ticker portion to 6 chars (OCC standard)
          const match = tradingSymbol.match(/^([A-Z]{1,6})(\d{6}[CP]\d{8})$/);
          if (match) {
            const ticker = match[1].padEnd(6, ' ');
            tradingSymbol = ticker + match[2];
          }
        }

        // Calculate user-specific quantity (apply size_pct)
        const baseQty = body.qty || 1;
        const userQty = Math.max(1, Math.round(baseQty * parseFloat(user.size_pct)));

        const orderResult = await placeOrder({
          userId: user.snaptrade_user_id,
          userSecret: user.snaptrade_user_secret,
          accountId: user.snaptrade_selected_account,
          symbol: tradingSymbol,
          action: snapAction,
          quantity: userQty,
          orderType: 'Market',
          timeInForce: 'Day',
        });

        const orderId = orderResult?.brokerage_order_id || 'unknown';
        console.log(
          `[HeliosWebhook] ✅ Order placed for ${user.username} (${user.id}): ${orderId}`
        );

        results.push({
          userId: user.id,
          username: user.username,
          status: 'success',
          orderId,
        });

        // Log trade in user's trade history
        await client.query(
          `INSERT INTO trades (user_id, symbol, direction, asset_type, quantity, entry_price, entry_date, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'open', $7)`,
          [
            user.id,
            body.ticker,
            isOption
              ? body.action.toLowerCase() === 'buy'
                ? 'CALL'
                : 'PUT'
              : body.action.toUpperCase(),
            isOption ? 'option' : 'stock',
            userQty,
            body.price || 0,
            `Auto-execute from Helios signal ${body.signal_id}: ${JSON.stringify({
              orderId,
              symbol: tradingSymbol,
              action: snapAction,
              reason: body.reason,
            })}`,
          ]
        );

        // Audit log
        await logAutoExecution(client, {
          signal_id: body.signal_id,
          ticker: body.ticker,
          action: body.action,
          contract_symbol: body.contract_symbol || null,
          user_id: user.id,
          username: user.username,
          status: 'success',
          details: JSON.stringify({
            orderId,
            quantity: userQty,
            symbol: tradingSymbol,
            snapAction,
          }),
        });
      } catch (userError: unknown) {
        const errorMsg =
          userError instanceof Error ? userError.message : 'Unknown execution error';
        console.error(
          `[HeliosWebhook] ❌ Execution failed for ${user.username} (${user.id}):`,
          errorMsg
        );

        results.push({
          userId: user.id,
          username: user.username,
          status: 'error',
          error: errorMsg,
        });

        await logAutoExecution(client, {
          signal_id: body.signal_id,
          ticker: body.ticker,
          action: body.action,
          contract_symbol: body.contract_symbol || null,
          user_id: user.id,
          username: user.username,
          status: 'error',
          details: errorMsg,
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const failCount = results.filter((r) => r.status === 'error').length;

    console.log(
      `[HeliosWebhook] Complete: ${successCount} succeeded, ${failCount} failed out of ${eligibleUsers.length} users`
    );

    return NextResponse.json({
      success: true,
      signal_id: body.signal_id,
      executions: successCount,
      failures: failCount,
      results,
    });
  } catch (error: unknown) {
    console.error('[HeliosWebhook] Fatal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// --- Audit log helper ---
async function logAutoExecution(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  data: {
    signal_id: string;
    ticker: string;
    action: string;
    contract_symbol: string | null;
    user_id: number | null;
    username: string | null;
    status: string;
    details: string;
  }
) {
  try {
    await client.query(
      `INSERT INTO auto_execution_log
         (signal_id, ticker, action, contract_symbol, user_id, username, status, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [
        data.signal_id,
        data.ticker,
        data.action,
        data.contract_symbol,
        data.user_id,
        data.username,
        data.status,
        data.details,
      ]
    );
  } catch (err) {
    console.error('[HeliosWebhook] Failed to log auto-execution:', err);
  }
}
