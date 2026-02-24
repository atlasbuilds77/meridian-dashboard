import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

// GET - Get billing history
export async function GET(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'billing_history',
    limit: 60,
    windowMs: 60_000,
    userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'billing_history');
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Get billing periods
    const periodsResult = await pool.query(
      `SELECT
        bp.id,
        bp.week_start,
        bp.week_end,
        bp.total_pnl,
        bp.fee_amount,
        bp.fee_percentage,
        bp.status,
        bp.paid_at,
        bp.created_at,
        p.receipt_url
      FROM billing_periods bp
      LEFT JOIN payments p ON p.billing_period_id = bp.id AND p.status = 'succeeded'
      WHERE bp.user_id = $1
      ORDER BY bp.week_start DESC
      LIMIT $2`,
      [userId, limit]
    );

    // Get summary stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total_periods,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_periods,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_periods,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN fee_amount ELSE 0 END), 0) as total_fees_paid,
        COALESCE(SUM(total_pnl), 0) as lifetime_pnl
      FROM billing_periods
      WHERE user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0];

    return NextResponse.json({
      periods: periodsResult.rows,
      summary: {
        totalPeriods: parseInt(stats.total_periods),
        paidPeriods: parseInt(stats.paid_periods),
        failedPeriods: parseInt(stats.failed_periods),
        totalFeesPaid: parseFloat(stats.total_fees_paid),
        lifetimePnL: parseFloat(stats.lifetime_pnl)
      }
    });

  } catch (error: unknown) {
    console.error('Billing history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing history' },
      { status: 500 }
    );
  }
}
