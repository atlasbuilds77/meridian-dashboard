import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireUserId } from '@/lib/api/require-auth';
import { MERIDIAN_START_DATE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/daily-pnl
 *
 * Returns an array of { date, pnl, trades } for each day with closed trades,
 * filtered from MERIDIAN_START_DATE onwards.
 * Used by the P&L Heatmap Calendar component.
 */
export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const result = await pool.query(
      `WITH source_pref AS (
        SELECT EXISTS(
          SELECT 1
          FROM trades
          WHERE user_id = $1
            AND status = 'closed'
            AND tradier_position_id IS NOT NULL
        ) AS use_tradier
      ),
      closed_trades AS (
        SELECT
          t.*,
          COALESCE(
            t.pnl,
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
          ) AS pnl_value
        FROM trades t
        CROSS JOIN source_pref sp
        WHERE t.user_id = $1
          AND t.status = 'closed'
          AND COALESCE(t.entry_date, t.created_at) >= $2::date
          AND (
            (sp.use_tradier AND t.tradier_position_id IS NOT NULL)
            OR (NOT sp.use_tradier AND t.tradier_position_id IS NULL)
          )
      )
      SELECT
        DATE(entry_date)::text AS date,
        COALESCE(SUM(pnl_value), 0) AS pnl,
        COUNT(*)::int AS trades
      FROM closed_trades
      GROUP BY DATE(entry_date)
      ORDER BY DATE(entry_date)`,
      [authResult.userId, MERIDIAN_START_DATE]
    );

    const dailyPnl = result.rows.map((row) => ({
      date: row.date,
      pnl: Number.parseFloat(String(row.pnl)) || 0,
      trades: Number.parseInt(String(row.trades), 10) || 0,
    }));

    return NextResponse.json(dailyPnl);
  } catch (error: unknown) {
    console.error('Daily P&L fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily P&L' }, { status: 500 });
  }
}
