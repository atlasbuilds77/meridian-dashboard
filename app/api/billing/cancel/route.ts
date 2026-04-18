/**
 * POST /api/billing/cancel
 * Cancels the user's Helios Auto-Execute subscription at period end.
 * Webhook handles disabling auto-execute when subscription actually ends.
 */
import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { getStripeClient } from '@/lib/stripe/client';
import pool from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  const { rows } = await pool.query(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user?.stripe_customer_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  }

  const stripe = getStripeClient();
  const subs = await stripe.subscriptions.list({
    customer: user.stripe_customer_id,
    status: 'active',
    limit: 5,
  });

  const heliosSub = subs.data.find(sub =>
    sub.items.data.some(item => {
      const prod = typeof item.price.product === 'string' ? item.price.product : (item.price.product as { id: string })?.id;
      return prod === 'prod_UM8HXulGovpL3S';
    })
  );

  if (!heliosSub) {
    return NextResponse.json({ error: 'No active Helios Auto-Execute subscription' }, { status: 404 });
  }

  // Cancel at period end (not immediately) — user keeps access until they've paid through
  await stripe.subscriptions.update(heliosSub.id, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({
    success: true,
    message: 'Subscription will cancel at end of billing period',
    cancel_at: new Date(((heliosSub as unknown) as { current_period_end: number }).current_period_end * 1000).toISOString(),
  });
}
