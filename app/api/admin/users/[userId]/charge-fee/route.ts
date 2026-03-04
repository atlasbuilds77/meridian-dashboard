/**
 * Manual Fee Charge API
 *
 * POST /api/admin/users/[userId]/charge-fee
 *
 * Allows admin to manually charge 10% fee on positive weekly P&L.
 * Includes CSRF protection, rate limiting, and audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';
import { validateCsrfFromRequest } from '@/lib/security/csrf';
import { chargeCustomer } from '@/lib/stripe/client';

interface ChargeResult {
  success: boolean;
  paymentIntentId?: string;
  amount?: number;
  error?: string;
}

interface WeeklyPnlResult {
  totalPnl: number;
  tradeCount: number;
  source: 'tradier' | 'legacy';
}

const MARKET_TIMEZONE = 'America/Los_Angeles';

const COMMISSION_SQL = `
  COALESCE(
    t.commission,
    CASE
      WHEN (to_jsonb(t) ->> 'commission') ~ '^-?\\d+(\\.\\d+)?$'
        THEN (to_jsonb(t) ->> 'commission')::numeric
      WHEN (to_jsonb(t) ->> 'commissions') ~ '^-?\\d+(\\.\\d+)?$'
        THEN (to_jsonb(t) ->> 'commissions')::numeric
      ELSE NULL
    END,
    0
  )`;

const GROSS_PNL_SQL = `
  COALESCE(
    CASE
      WHEN (to_jsonb(t) ->> 'gross_pnl') ~ '^-?\\d+(\\.\\d+)?$'
        THEN (to_jsonb(t) ->> 'gross_pnl')::numeric
      ELSE NULL
    END,
    t.pnl,
    CASE
      WHEN t.net_pnl IS NOT NULL THEN t.net_pnl + (${COMMISSION_SQL})
      ELSE NULL
    END,
    CASE
      WHEN t.exit_price IS NULL THEN NULL
      WHEN UPPER(t.direction) IN ('LONG', 'CALL')
        THEN (t.exit_price - t.entry_price) * t.quantity *
             CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
      WHEN UPPER(t.direction) IN ('SHORT', 'PUT')
        THEN (t.entry_price - t.exit_price) * t.quantity *
             CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
      ELSE NULL
    END
  )`;

const NET_PNL_SQL = `
  COALESCE(
    t.net_pnl,
    CASE
      WHEN t.pnl IS NOT NULL THEN t.pnl - (${COMMISSION_SQL})
      ELSE NULL
    END,
    CASE
      WHEN (${GROSS_PNL_SQL}) IS NULL THEN NULL
      ELSE (${GROSS_PNL_SQL}) - (${COMMISSION_SQL})
    END
  )`;

/**
 * Current billing week in market timezone (Sunday-Saturday).
 */
async function getCurrentWeekDates(): Promise<{ weekStart: string; weekEnd: string }> {
  const result = await pool.query(`
    SELECT
      (
        (CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date
        - EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date)::int
      )::date AS week_start,
      (
        (
          (CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date
          - EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE '${MARKET_TIMEZONE}')::date)::int
        )::date + INTERVAL '6 day'
      )::date AS week_end
  `);

  const row = result.rows[0] || {};
  const formatDate = (value: unknown): string => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
  };

  return {
    weekStart: formatDate(row.week_start),
    weekEnd: formatDate(row.week_end),
  };
}

async function calculateWeeklyPnl(
  userId: number,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyPnlResult> {
  const result = await pool.query(
    `WITH scoped_trades AS (
      SELECT
        ${NET_PNL_SQL} AS net_pnl,
        COALESCE(
          (t.exit_date AT TIME ZONE '${MARKET_TIMEZONE}')::date,
          (t.entry_date AT TIME ZONE '${MARKET_TIMEZONE}')::date,
          (t.created_at AT TIME ZONE '${MARKET_TIMEZONE}')::date
        ) AS trade_date,
        CASE
          WHEN t.tradier_position_id IS NOT NULL THEN 'tradier'
          ELSE 'legacy'
        END AS pnl_source
      FROM trades t
      WHERE t.user_id = $1
        AND t.status = 'closed'
        AND COALESCE(
          (t.exit_date AT TIME ZONE '${MARKET_TIMEZONE}')::date,
          (t.entry_date AT TIME ZONE '${MARKET_TIMEZONE}')::date,
          (t.created_at AT TIME ZONE '${MARKET_TIMEZONE}')::date
        ) BETWEEN $2::date AND $3::date
    ),
    source_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE pnl_source = 'tradier') AS tradier_count,
        COUNT(*) FILTER (WHERE pnl_source = 'legacy') AS legacy_count,
        MAX(trade_date) FILTER (WHERE pnl_source = 'tradier') AS tradier_latest,
        MAX(trade_date) FILTER (WHERE pnl_source = 'legacy') AS legacy_latest
      FROM scoped_trades
    ),
    source_pref AS (
      SELECT
        CASE
          WHEN tradier_count = 0 AND legacy_count = 0 THEN NULL
          WHEN tradier_count = 0 THEN 'legacy'
          WHEN legacy_count = 0 THEN 'tradier'
          WHEN legacy_latest > tradier_latest THEN 'legacy'
          WHEN tradier_latest > legacy_latest THEN 'tradier'
          ELSE 'tradier'
        END AS preferred_source
      FROM source_stats
    ),
    selected_trades AS (
      SELECT st.net_pnl
      FROM scoped_trades st
      CROSS JOIN source_pref sp
      WHERE
        (sp.preferred_source = 'tradier' AND st.pnl_source = 'tradier')
        OR (sp.preferred_source = 'legacy' AND st.pnl_source = 'legacy')
    )
    SELECT
      COALESCE(SUM(net_pnl), 0) AS total_pnl,
      COUNT(*) FILTER (WHERE net_pnl IS NOT NULL)::INTEGER AS trade_count,
      COALESCE((SELECT preferred_source FROM source_pref), 'legacy') AS source
    FROM selected_trades`,
    [userId, weekStart, weekEnd]
  );

  const row = result.rows[0] || {};
  const source = row.source === 'tradier' ? 'tradier' : 'legacy';

  return {
    totalPnl: parseFloat(String(row.total_pnl ?? 0)) || 0,
    tradeCount: parseInt(String(row.trade_count ?? 0), 10) || 0,
    source,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  // 1. Admin authentication
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  // 2. CSRF validation
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response!;
  }

  const resolvedParams = await params;
  const userId = parseInt(resolvedParams.userId, 10);
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const adminDiscordId = adminResult.session.discordId;

  try {
    // 3. Get user info including Stripe details
    const userResult = await pool.query(
      `SELECT
        u.id,
        u.username,
        u.stripe_customer_id,
        u.billing_enabled,
        upm.stripe_payment_method_id
      FROM users u
      LEFT JOIN user_payment_methods upm ON upm.user_id = u.id AND upm.is_default = true
      WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // 4. Check if user has payment method
    if (!user.stripe_customer_id || !user.stripe_payment_method_id) {
      return NextResponse.json(
        { error: 'User does not have a saved payment method' },
        { status: 400 }
      );
    }

    // 5. Get week dates
    const { weekStart, weekEnd } = await getCurrentWeekDates();

    // 6. Check if already charged this week (rate limiting)
    const existingChargeResult = await pool.query(
      `SELECT id, status FROM billing_periods
       WHERE user_id = $1
         AND week_start = $2
         AND week_end = $3
         AND status IN ('paid', 'pending')`,
      [userId, weekStart, weekEnd]
    );

    if (existingChargeResult.rows.length > 0) {
      const existing = existingChargeResult.rows[0];
      return NextResponse.json(
        {
          error: `Already ${existing.status === 'paid' ? 'charged' : 'pending charge'} for this week`,
          billingPeriodId: existing.id,
        },
        { status: 409 }
      );
    }

    // 7. Calculate weekly NET P&L for current billing week (prefer Tradier source rows)
    const weeklyPnl = await calculateWeeklyPnl(userId, weekStart, weekEnd);
    const totalPnl = weeklyPnl.totalPnl;
    const tradeCount = weeklyPnl.tradeCount;

    // 8. Check if P&L is positive
    if (totalPnl <= 0) {
      return NextResponse.json(
        {
          error: 'Cannot charge fee on zero or negative P&L',
          totalPnl,
          tradeCount,
          pnlSource: weeklyPnl.source,
        },
        { status: 400 }
      );
    }

    // 9. Calculate fee (10%)
    const feeAmount = totalPnl * 0.10;
    const feeAmountCents = Math.round(feeAmount * 100);

    // 10. Create billing period record
    const periodResult = await pool.query(
      `INSERT INTO billing_periods (
        user_id,
        week_start,
        week_end,
        total_pnl,
        fee_amount,
        fee_percentage,
        status
      ) VALUES ($1, $2, $3, $4, $5, 10.00, 'pending')
      RETURNING id`,
      [userId, weekStart, weekEnd, totalPnl, feeAmount]
    );

    const periodId = periodResult.rows[0].id;

    // 11. Log the charge attempt
    await pool.query(
      `INSERT INTO billing_events (
        user_id,
        billing_period_id,
        event_type,
        event_data
      ) VALUES ($1, $2, 'charge_attempted', $3)`,
      [
        userId,
        periodId,
        JSON.stringify({
          adminDiscordId,
          totalPnl,
          feeAmount,
          tradeCount,
          pnlSource: weeklyPnl.source,
          manual: true,
        }),
      ]
    );

    // 12. Attempt to charge via Stripe
    let chargeResult: ChargeResult;

    try {
      const paymentIntent = await chargeCustomer({
        customerId: user.stripe_customer_id,
        paymentMethodId: user.stripe_payment_method_id,
        amount: feeAmountCents,
        description: `Meridian Automation Fee - Week ${weekStart} to ${weekEnd}`,
        metadata: {
          userId: userId.toString(),
          billingPeriodId: periodId.toString(),
          weekStart,
          weekEnd,
          totalPnL: totalPnl.toString(),
          feePercentage: '10',
          manualCharge: 'true',
          adminDiscordId,
        },
      });

      // 13. Update billing period with success
      await pool.query(
        `UPDATE billing_periods
        SET status = 'paid',
            stripe_payment_intent_id = $1,
            paid_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [paymentIntent.id, periodId]
      );

      // 14. Record payment
      await pool.query(
        `INSERT INTO payments (
          user_id,
          billing_period_id,
          amount,
          stripe_payment_intent_id,
          stripe_charge_id,
          payment_method_id,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'succeeded')`,
        [
          userId,
          periodId,
          feeAmount,
          paymentIntent.id,
          paymentIntent.latest_charge,
          user.stripe_payment_method_id,
        ]
      );

      // 15. Log success
      await pool.query(
        `INSERT INTO billing_events (
          user_id,
          billing_period_id,
          event_type,
          event_data
        ) VALUES ($1, $2, 'charge_succeeded', $3)`,
        [
          userId,
          periodId,
          JSON.stringify({
            paymentIntentId: paymentIntent.id,
            amount: feeAmount,
            adminDiscordId,
            manual: true,
          }),
        ]
      );

      chargeResult = {
        success: true,
        paymentIntentId: paymentIntent.id,
        amount: feeAmount,
      };
    } catch (chargeError: unknown) {
      const errorMessage = chargeError instanceof Error ? chargeError.message : String(chargeError);

      // Update billing period with failure
      await pool.query(
        `UPDATE billing_periods
        SET status = 'failed',
            attempt_count = attempt_count + 1,
            last_attempt_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [periodId]
      );

      // Record failed payment
      await pool.query(
        `INSERT INTO payments (
          user_id,
          billing_period_id,
          amount,
          payment_method_id,
          status,
          failure_reason
        ) VALUES ($1, $2, $3, $4, 'failed', $5)`,
        [userId, periodId, feeAmount, user.stripe_payment_method_id, errorMessage]
      );

      // Log failure
      await pool.query(
        `INSERT INTO billing_events (
          user_id,
          billing_period_id,
          event_type,
          event_data
        ) VALUES ($1, $2, 'charge_failed', $3)`,
        [
          userId,
          periodId,
          JSON.stringify({
            error: errorMessage,
            amount: feeAmount,
            adminDiscordId,
            manual: true,
          }),
        ]
      );

      chargeResult = {
        success: false,
        error: errorMessage,
      };
    }

    // 16. Return result
    if (chargeResult.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully charged $${feeAmount.toFixed(2)} for ${user.username}`,
        billingPeriodId: periodId,
        paymentIntentId: chargeResult.paymentIntentId,
        weekStart,
        weekEnd,
        totalPnl,
        feeAmount,
        tradeCount,
        pnlSource: weeklyPnl.source,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: chargeResult.error,
        billingPeriodId: periodId,
        weekStart,
        weekEnd,
        totalPnl,
        feeAmount,
        tradeCount,
        pnlSource: weeklyPnl.source,
      },
      { status: 402 } // Payment Required
    );
  } catch (error: unknown) {
    console.error('Manual charge error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users/[userId]/charge-fee
 *
 * Returns weekly P&L info and charge eligibility
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  // Preserve request reference for parity with other handlers.
  void request;

  // Admin authentication
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const resolvedParams = await params;
  const userId = parseInt(resolvedParams.userId, 10);
  if (!userId || isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  try {
    // Get user info
    const userResult = await pool.query(
      `SELECT
        u.id,
        u.username,
        u.stripe_customer_id,
        u.billing_enabled,
        upm.stripe_payment_method_id,
        upm.card_brand,
        upm.card_last4
      FROM users u
      LEFT JOIN user_payment_methods upm ON upm.user_id = u.id AND upm.is_default = true
      WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];
    const { weekStart, weekEnd } = await getCurrentWeekDates();

    // Calculate weekly NET P&L for current billing week (prefer Tradier source rows)
    const weeklyPnl = await calculateWeeklyPnl(userId, weekStart, weekEnd);
    const totalPnl = weeklyPnl.totalPnl;
    const tradeCount = weeklyPnl.tradeCount;
    const feeAmount = totalPnl > 0 ? totalPnl * 0.10 : 0;

    // Check if already charged this week
    const existingChargeResult = await pool.query(
      `SELECT id, status, paid_at, stripe_payment_intent_id
       FROM billing_periods
       WHERE user_id = $1
         AND week_start = $2
         AND week_end = $3`,
      [userId, weekStart, weekEnd]
    );

    const existingCharge = existingChargeResult.rows[0] || null;

    // Get last 5 charges
    const chargeHistoryResult = await pool.query(
      `SELECT
        bp.id,
        bp.week_start,
        bp.week_end,
        bp.total_pnl,
        bp.fee_amount,
        bp.status,
        bp.stripe_payment_intent_id,
        bp.paid_at,
        p.stripe_charge_id
      FROM billing_periods bp
      LEFT JOIN payments p ON p.billing_period_id = bp.id AND p.status = 'succeeded'
      WHERE bp.user_id = $1
      ORDER BY bp.week_start DESC
      LIMIT 5`,
      [userId]
    );

    const hasPaymentMethod = !!(user.stripe_customer_id && user.stripe_payment_method_id);
    const canCharge = hasPaymentMethod && totalPnl > 0 && (!existingCharge || existingCharge.status === 'failed');

    return NextResponse.json({
      weekStart,
      weekEnd,
      totalPnl,
      tradeCount,
      pnlSource: weeklyPnl.source,
      feeAmount,
      hasPaymentMethod,
      paymentMethod: hasPaymentMethod
        ? {
            brand: user.card_brand,
            last4: user.card_last4,
          }
        : null,
      billingEnabled: user.billing_enabled,
      existingCharge: existingCharge
        ? {
            id: existingCharge.id,
            status: existingCharge.status,
            paidAt: existingCharge.paid_at,
            paymentIntentId: existingCharge.stripe_payment_intent_id,
          }
        : null,
      canCharge,
      chargeHistory: chargeHistoryResult.rows.map((row) => ({
        id: row.id,
        weekStart: row.week_start,
        weekEnd: row.week_end,
        totalPnl: parseFloat(row.total_pnl),
        feeAmount: parseFloat(row.fee_amount),
        status: row.status,
        paidAt: row.paid_at,
        stripeChargeId: row.stripe_charge_id,
      })),
    });
  } catch (error: unknown) {
    console.error('Charge info fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
