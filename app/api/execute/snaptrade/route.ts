import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { getSnapTradeData, type TradingSystem } from '@/lib/db/snaptrade-users';
import { placeOrder, isConfigured } from '@/lib/snaptrade/client';
import { validateCsrfFromRequest } from '@/lib/security/csrf';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

/**
 * POST /api/execute/snaptrade
 * 
 * Execute a trade via SnapTrade for the logged-in user.
 * 
 * Body: {
 *   symbol: string,        // e.g. "SPY" or option symbol
 *   action: "buy" | "sell",
 *   quantity: number,
 *   isOption?: boolean,
 *   optionSymbol?: string,  // OCC-style option symbol if isOption
 *   orderType?: "Market" | "Limit",
 *   price?: number,         // required for Limit orders
 *   system?: 'helios' | 'meridian', // which system is executing (default: meridian)
 * }
 */
export async function POST(request: NextRequest) {
  // Auth
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  // CSRF
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) return csrfResult.response;

  // Check SnapTrade configured
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'SnapTrade is not configured on this server' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { symbol, action, quantity, isOption, optionSymbol, orderType, price } = body;
    const system: TradingSystem = body.system === 'helios' ? 'helios' : 'meridian';

    // Validate required fields
    if (!symbol || !action || !quantity) {
      return NextResponse.json(
        { error: 'symbol, action, and quantity are required' },
        { status: 400 }
      );
    }

    if (!['buy', 'sell'].includes(action.toLowerCase())) {
      return NextResponse.json(
        { error: 'action must be "buy" or "sell"' },
        { status: 400 }
      );
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be a positive number' },
        { status: 400 }
      );
    }

    // Get user's SnapTrade credentials
    const snapData = await getSnapTradeData(userId);

    if (!snapData?.snaptrade_user_id || !snapData?.snaptrade_user_secret) {
      return NextResponse.json(
        { error: 'SnapTrade not connected. Please connect your broker in Settings.' },
        { status: 400 }
      );
    }

    // Use system-specific account, fall back to legacy selected account
    const systemAccountKey = system === 'helios' ? 'helios_snaptrade_account' : 'meridian_snaptrade_account';
    const accountId = snapData[systemAccountKey] || snapData.snaptrade_selected_account;

    if (!accountId) {
      const systemLabel = system.charAt(0).toUpperCase() + system.slice(1);
      return NextResponse.json(
        { error: `No broker account selected for ${systemLabel}. Please select an account in Settings.` },
        { status: 400 }
      );
    }

    // Determine the trading action for SnapTrade
    const tradingSymbol = isOption && optionSymbol ? optionSymbol : symbol;
    let snapAction: 'BUY' | 'SELL' | 'BUY_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_OPEN' | 'SELL_TO_CLOSE';

    if (isOption) {
      snapAction = action.toLowerCase() === 'buy' ? 'BUY_TO_OPEN' : 'SELL_TO_CLOSE';
    } else {
      snapAction = action.toUpperCase() as 'BUY' | 'SELL';
    }

    // Place the order using system-specific account
    const orderResult = await placeOrder({
      userId: snapData.snaptrade_user_id,
      userSecret: snapData.snaptrade_user_secret,
      accountId,
      symbol: tradingSymbol,
      action: snapAction,
      quantity,
      orderType: orderType || 'Market',
      timeInForce: 'Day',
      ...(price != null ? { price } : {}),
    });

    // Log execution in DB
    await pool.query(
      `INSERT INTO trades (user_id, symbol, direction, asset_type, quantity, entry_price, entry_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'open', $7)`,
      [
        userId,
        symbol,
        isOption ? (action.toLowerCase() === 'buy' ? 'CALL' : 'PUT') : (action.toUpperCase() as string),
        isOption ? 'option' : 'stock',
        quantity,
        price || 0,
        `SnapTrade order: ${JSON.stringify({
          orderId: orderResult?.brokerage_order_id,
          status: orderResult?.status,
          symbol: tradingSymbol,
        })}`,
      ]
    );

    return NextResponse.json({
      success: true,
      order: {
        orderId: orderResult?.brokerage_order_id,
        status: orderResult?.status,
        symbol: tradingSymbol,
        action: snapAction,
        quantity,
        filled_quantity: orderResult?.filled_quantity,
      },
    });
  } catch (error: unknown) {
    console.error('[SnapTrade Execute] Error:', error);
    const message = error instanceof Error ? error.message : 'Trade execution failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
