import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sync-orders
 * Returns count of pending orders (admin-only)
 */
export async function GET() {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  try {
    const result = await pool.query(`
      SELECT COUNT(*) as pending_count
      FROM orders 
      WHERE status = 'pending'
      AND created_at > NOW() - INTERVAL '7 days'
    `);

    const count = parseInt(result.rows[0]?.pending_count || '0', 10);
    
    return NextResponse.json({
      pendingCount: count,
      message: `Found ${count} pending orders. Run sync_all_orders.py to update.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync check error:', error);
    return NextResponse.json({ error: 'Failed to check orders' }, { status: 500 });
  }
}
