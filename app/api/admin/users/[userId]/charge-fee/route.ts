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
import { buildNetPnlSql } from '@/lib/db/pnl-sql';

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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MARKET_TIMEZONE = 'America/Los_Angeles';
const NET_PNL_SQL = buildNetPnlSql('t');

const MARKET_WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Build a timezone-safe calendar date (YYYY-MM-DD) for a specific zone.
 */
function getZonedDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '0');
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '0');
  return { year, month, day };
}

function getWeekdayInTimezone(date: Date, timeZone: string): number {
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);
  return MARKET_WEEKDAY_INDEX[weekdayShort] ?? 0;
}

function formatUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current calendar week dates (Monday through Sunday) in market timezone.
 */
function getCurrentWeekDates(now = new Date()): { weekStart: string; weekEnd: string } {
  const zonedParts = getZonedDateParts(now, MARKET_TIMEZONE);
  const weekday = getWeekdayInTimezone(now, MARKET_TIMEZONE);

  const marketDate = new Date(Date.UTC(zonedParts.year, zonedParts.month - 1, zonedParts.day));
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const weekStartDate = new Date(marketDate);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - daysFromMonday);

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);

  return {
    weekStart: formatUtcDateOnly(weekStartDate),
    weekEnd: formatUtcDateOnly(weekEndDate),
  };
}

async function calculateWeeklyPnl(
  userId: number,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyPnlResult> {
  // Source-of-truth pass: only Tradier gain/loss synced rows.
  const tradierResult = await pool.query(
    `WITH trades_with_pnl AS (
      SELECT ${NET_PNL_SQL} AS net_pnl
      FROM trades t
      WHERE t.user_id = $1
        AND t.status = 'closed'
        AND t.tradier_position_id IS NOT NULL
        AND ((exit_date AT TIME ZONE '${MARKET_TIMEZONE}')::date BETWEEN $2::date AND $3::date)
    )
    SELECT
      COALESCE(SUM(net_pnl), 0) AS total_pnl,
      COUNT(*) FILTER (WHERE net_pnl IS NOT NULL)::INTEGER AS trade_count
    FROM trades_with_pnl`,
    [userId, weekStart, weekEnd]
  );

  const tradierTradeCount = parseInt(String(tradierResult.rows[0].trade_count || 0), 10) || 0;
  if (tradierTradeCount > 0) {
    return {
      totalPnl: parseFloat(String(tradierResult.rows[0].total_pnl || 0)) || 0,
      tradeCount: tradierTradeCount,
      source: 'tradier',
    };
  }

  // Fallback pass: legacy manually inserted rows with no Tradier position id.
  const legacyResult = await pool.query(
    `WITH trades_with_pnl AS (
      SELECT ${NET_PNL_SQL} AS net_pnl
      FROM trades t
      WHERE t.user_id = $1
        AND t.status = 'closed'
        AND t.tradier_position_id IS NULL
        AND ((exit_date AT TIME ZONE '${MARKET_TIMEZONE}')::date BETWEEN $2::date AND $3::date)
    )
    SELECT
      COALESCE(SUM(net_pnl), 0) AS total_pnl,
      COUNT(*) FILTER (WHERE net_pnl IS NOT NULL)::INTEGER AS trade_count
    FROM trades_with_pnl`,
    [userId, weekStart, weekEnd]
  );

  return {
    totalPnl: parseFloat(String(legacyResult.rows[0].total_pnl || 0)) || 0,
    tradeCount: parseInt(String(legacyResult.rows[0].trade_count || 0), 10) || 0,
    source: 'legacy',
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

    // 5. Get current week dates
    const { weekStart, weekEnd } = getCurrentWeekDates();

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

    // 7. Calculate weekly P&L for the current week (market timezone)
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
    const { weekStart, weekEnd } = getCurrentWeekDates();

    // Calculate weekly P&L for the current week (market timezone)
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

    return NextResponse.json(
      {
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
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Charge info fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
