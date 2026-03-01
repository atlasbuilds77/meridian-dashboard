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

/**
 * Get last trading week dates (Monday through Friday ONLY)
 * Weekend trades are excluded from billing
 */
function getLastWeekDates(): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  
  // Last Monday (most recent Monday before today)
  const lastMonday = new Date(today);
  // If today is Sunday (0), go back 6 days; if Monday (1), go back 7; etc
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6;
  lastMonday.setDate(today.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);
  
  // Last Friday (4 days after last Monday)
  const lastFriday = new Date(lastMonday);
  lastFriday.setDate(lastMonday.getDate() + 4);
  lastFriday.setHours(23, 59, 59, 999);
  
  return {
    weekStart: lastMonday.toISOString().split('T')[0],
    weekEnd: lastFriday.toISOString().split('T')[0]
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
    const { weekStart, weekEnd } = getLastWeekDates();

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
          billingPeriodId: existing.id
        },
        { status: 409 }
      );
    }

    // 7. Calculate weekly P&L (Mon-Fri only, with dynamic P&L calculation)
    // Uses COALESCE to calculate P&L from entry/exit prices when stored pnl is NULL
    const pnlResult = await pool.query(
      `WITH trades_with_pnl AS (
        SELECT 
          COALESCE(
            pnl,
            CASE
              WHEN exit_price IS NULL THEN NULL
              WHEN UPPER(direction) IN ('LONG', 'CALL')
                THEN (exit_price - entry_price) * quantity * 
                     CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
              WHEN UPPER(direction) IN ('SHORT', 'PUT')
                THEN (entry_price - exit_price) * quantity * 
                     CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
              ELSE NULL
            END
          ) AS calculated_pnl
        FROM trades
        WHERE user_id = $1
          AND entry_date >= $2
          AND entry_date < ($3::date + INTERVAL '1 day')
          AND EXTRACT(DOW FROM entry_date) BETWEEN 1 AND 5  -- Mon=1 to Fri=5
          AND status = 'closed'
      )
      SELECT 
        COALESCE(SUM(calculated_pnl), 0) as total_pnl,
        COUNT(*) FILTER (WHERE calculated_pnl IS NOT NULL)::INTEGER as trade_count
      FROM trades_with_pnl`,
      [userId, weekStart, weekEnd]
    );

    const totalPnl = parseFloat(pnlResult.rows[0].total_pnl);
    const tradeCount = parseInt(pnlResult.rows[0].trade_count);

    // 8. Check if P&L is positive
    if (totalPnl <= 0) {
      return NextResponse.json(
        { 
          error: 'Cannot charge fee on zero or negative P&L',
          totalPnl,
          tradeCount
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
      [userId, periodId, JSON.stringify({
        adminDiscordId,
        totalPnl,
        feeAmount,
        tradeCount,
        manual: true
      })]
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
          adminDiscordId
        }
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
          user.stripe_payment_method_id
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
        [userId, periodId, JSON.stringify({
          paymentIntentId: paymentIntent.id,
          amount: feeAmount,
          adminDiscordId,
          manual: true
        })]
      );

      chargeResult = {
        success: true,
        paymentIntentId: paymentIntent.id,
        amount: feeAmount
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
        [userId, periodId, JSON.stringify({
          error: errorMessage,
          amount: feeAmount,
          adminDiscordId,
          manual: true
        })]
      );

      chargeResult = {
        success: false,
        error: errorMessage
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
        tradeCount
      });
    } else {
      return NextResponse.json({
        success: false,
        error: chargeResult.error,
        billingPeriodId: periodId,
        weekStart,
        weekEnd,
        totalPnl,
        feeAmount,
        tradeCount
      }, { status: 402 }); // Payment Required
    }

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
    const { weekStart, weekEnd } = getLastWeekDates();

    // Calculate weekly P&L (Mon-Fri only, with dynamic P&L calculation)
    const pnlResult = await pool.query(
      `WITH trades_with_pnl AS (
        SELECT 
          COALESCE(
            pnl,
            CASE
              WHEN exit_price IS NULL THEN NULL
              WHEN UPPER(direction) IN ('LONG', 'CALL')
                THEN (exit_price - entry_price) * quantity * 
                     CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
              WHEN UPPER(direction) IN ('SHORT', 'PUT')
                THEN (entry_price - exit_price) * quantity * 
                     CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
              ELSE NULL
            END
          ) AS calculated_pnl
        FROM trades
        WHERE user_id = $1
          AND entry_date >= $2
          AND entry_date < ($3::date + INTERVAL '1 day')
          AND EXTRACT(DOW FROM entry_date) BETWEEN 1 AND 5  -- Mon=1 to Fri=5
          AND status = 'closed'
      )
      SELECT 
        COALESCE(SUM(calculated_pnl), 0) as total_pnl,
        COUNT(*) FILTER (WHERE calculated_pnl IS NOT NULL)::INTEGER as trade_count
      FROM trades_with_pnl`,
      [userId, weekStart, weekEnd]
    );

    const totalPnl = parseFloat(pnlResult.rows[0].total_pnl);
    const tradeCount = parseInt(pnlResult.rows[0].trade_count);
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
      feeAmount,
      hasPaymentMethod,
      paymentMethod: hasPaymentMethod ? {
        brand: user.card_brand,
        last4: user.card_last4
      } : null,
      billingEnabled: user.billing_enabled,
      existingCharge: existingCharge ? {
        id: existingCharge.id,
        status: existingCharge.status,
        paidAt: existingCharge.paid_at,
        paymentIntentId: existingCharge.stripe_payment_intent_id
      } : null,
      canCharge,
      chargeHistory: chargeHistoryResult.rows.map(row => ({
        id: row.id,
        weekStart: row.week_start,
        weekEnd: row.week_end,
        totalPnl: parseFloat(row.total_pnl),
        feeAmount: parseFloat(row.fee_amount),
        status: row.status,
        paidAt: row.paid_at,
        stripeChargeId: row.stripe_charge_id
      }))
    });

  } catch (error: unknown) {
    console.error('Charge info fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
