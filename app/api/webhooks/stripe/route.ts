import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getStripeClient } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return secret;
}

async function hasProcessedEvent(eventId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM billing_events WHERE stripe_event_id = $1 LIMIT 1',
    [eventId]
  );

  return result.rows.length > 0;
}

async function findPaymentByIntentId(paymentIntentId: string) {
  const result = await pool.query(
    `SELECT id, user_id, billing_period_id, status
     FROM payments
     WHERE stripe_payment_intent_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [paymentIntentId]
  );

  return result.rows[0] as
    | { id: number; user_id: number; billing_period_id: number | null; status: string }
    | undefined;
}

async function logBillingEvent(params: {
  userId: number;
  billingPeriodId: number | null;
  eventType: 'charge_succeeded' | 'charge_failed' | 'refund_issued';
  stripeEventId: string;
  eventData: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO billing_events (user_id, billing_period_id, event_type, event_data, stripe_event_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.userId, params.billingPeriodId, params.eventType, JSON.stringify(params.eventData), params.stripeEventId]
  );
}

async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const payment = await findPaymentByIntentId(paymentIntent.id);
  if (!payment) {
    return;
  }

  const chargeId =
    typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id || null;

  await pool.query(
    `UPDATE payments
     SET status = 'succeeded',
         stripe_charge_id = COALESCE($2, stripe_charge_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [payment.id, chargeId]
  );

  if (payment.billing_period_id) {
    await pool.query(
      `UPDATE billing_periods
       SET status = 'paid',
           paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
           last_attempt_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [payment.billing_period_id]
    );
  }

  await logBillingEvent({
    userId: payment.user_id,
    billingPeriodId: payment.billing_period_id,
    eventType: 'charge_succeeded',
    stripeEventId: event.id,
    eventData: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount_received / 100,
    },
  });
}

async function handlePaymentIntentFailed(
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const payment = await findPaymentByIntentId(paymentIntent.id);
  if (!payment) {
    return;
  }

  const failureReason =
    paymentIntent.last_payment_error?.message ||
    paymentIntent.last_payment_error?.code ||
    'payment_failed';

  await pool.query(
    `UPDATE payments
     SET status = 'failed',
         failure_reason = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [payment.id, failureReason]
  );

  if (payment.billing_period_id) {
    await pool.query(
      `UPDATE billing_periods
       SET status = 'failed',
           attempt_count = attempt_count + 1,
           last_attempt_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [payment.billing_period_id]
    );
  }

  await logBillingEvent({
    userId: payment.user_id,
    billingPeriodId: payment.billing_period_id,
    eventType: 'charge_failed',
    stripeEventId: event.id,
    eventData: {
      paymentIntentId: paymentIntent.id,
      failureReason,
    },
  });
}

async function handleChargeRefunded(event: Stripe.Event, charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) {
    return;
  }

  const payment = await findPaymentByIntentId(paymentIntentId);
  if (!payment) {
    return;
  }

  await pool.query(
    `UPDATE payments
     SET status = 'refunded',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [payment.id]
  );

  await logBillingEvent({
    userId: payment.user_id,
    billingPeriodId: payment.billing_period_id,
    eventType: 'refund_issued',
    stripeEventId: event.id,
    eventData: {
      paymentIntentId,
      chargeId: charge.id,
      amountRefunded: (charge.amount_refunded || 0) / 100,
    },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    // Add 300 second (5 min) tolerance to prevent replay attacks
    const tolerance = 300;
    event = getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      getWebhookSecret(),
      tolerance
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('timestamp')) {
      console.error('Stripe webhook timestamp too old (possible replay attack):', error);
      return NextResponse.json({ error: 'Webhook timestamp invalid' }, { status: 400 });
    }
    console.error('Invalid Stripe webhook signature:', error);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  try {
    if (await hasProcessedEvent(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event, event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event, event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event, event.data.object as Stripe.Charge);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Stripe webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
