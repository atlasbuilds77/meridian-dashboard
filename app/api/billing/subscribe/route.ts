/**
 * POST /api/billing/subscribe
 * Creates a Stripe Checkout session for Helios Auto-Execute subscription.
 * On success, Stripe redirects to /settings?subscribed=true
 * Webhook (stripe/route.ts) handles enabling auto-execute.
 */
import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api/require-auth';
import { getStripeClient } from '@/lib/stripe/client';
import pool from '@/lib/db/pool';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const HELIOS_PRICES = {
  monthly: 'price_1TNQ0uQVfeouH9H6V01k1dXa',  // $99/mo
  annual:  'price_1TNQ0uQVfeouH9H6m6uWG9B0',  // $990/yr
};

const BodySchema = z.object({
  interval: z.enum(['monthly', 'annual']).default('monthly'),
});

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;
  const userId = authResult.userId;

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  const interval = parsed.success ? parsed.data.interval : 'monthly';
  const priceId = HELIOS_PRICES[interval];

  // Get or create Stripe customer
  const { rows } = await pool.query(
    'SELECT email, stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const stripe = getStripeClient();
  let customerId = user.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: String(userId) },
    });
    customerId = customer.id;
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customerId, userId]
    );
  }

  // Check if already subscribed
  const existing = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 5,
  });
  const alreadyActive = existing.data.some(sub =>
    sub.items.data.some(item => {
      const prod = typeof item.price.product === 'string' ? item.price.product : (item.price.product as { id: string })?.id;
      return prod === 'prod_UM8HXulGovpL3S';
    })
  );
  if (alreadyActive) {
    return NextResponse.json({ error: 'Already subscribed to Helios Auto-Execute' }, { status: 400 });
  }

  const origin = request.headers.get('origin') || 'https://meridian.zerogtrading.com';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings?subscribed=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/settings?cancelled=true`,
    metadata: { user_id: String(userId), tier: 'helios_auto_execute' },
    subscription_data: {
      metadata: { user_id: String(userId), tier: 'helios_auto_execute' },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
