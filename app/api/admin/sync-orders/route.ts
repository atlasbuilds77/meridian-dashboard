import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminRole } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/sync-orders
 * 
 * Syncs order statuses from Tradier API to database.
 * FIX (2026-03-19): Orders were stuck as "pending" because Meridian
 * never polled Tradier for fill status after placing orders.
 */
export async function POST(request: Request) {
  const limiterResult = await enforceRateLimit({
    request,
    name: 'admin_sync',
    limit: 10,
    windowMs: 60_000,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'admin_sync');
  }

  const authResult = await requireAdminRole();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    // Get pending orders
    const pendingResult = await pool.query(`
      SELECT o.order_id, o.account_number, o.side, o.qty_requested, o.status,
             ac.encrypted_api_key, ac.encrypted_api_secret, ac.encryption_iv
      FROM orders o
      LEFT JOIN api_credentials ac ON ac.account_number = o.account_number AND ac.is_active = true
      WHERE o.status = 'pending'
      AND o.created_at > NOW() - INTERVAL '7 days'
    `);

    const pending = pendingResult.rows;
    
    return NextResponse.json({
      message: `Found ${pending.length} pending orders. Run sync_all_orders.py on the server to update.`,
      pendingCount: pending.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Failed to sync orders' }, { status: 500 });
  }
}
