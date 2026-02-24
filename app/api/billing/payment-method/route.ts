import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';
import { z } from 'zod';
import { 
  attachPaymentMethod, 
  setDefaultPaymentMethod, 
  getPaymentMethod,
  detachPaymentMethod 
} from '@/lib/stripe/client';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { validateCsrfFromRequest } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';

const paymentMethodIdSchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
  }),
]);

const paymentMethodPayloadSchema = z.object({
  paymentMethodId: paymentMethodIdSchema.optional(),
  payment_method_id: paymentMethodIdSchema.optional(),
});

function normalizePaymentMethodId(
  value: z.infer<typeof paymentMethodIdSchema> | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  return typeof value === 'string' ? value : value.id;
}

// GET - Get user's payment methods
export async function GET() {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const result = await pool.query(
      `SELECT 
        id,
        stripe_payment_method_id,
        payment_method_type,
        card_brand,
        card_last4,
        card_exp_month,
        card_exp_year,
        is_default,
        created_at
      FROM user_payment_methods
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    
    return NextResponse.json({
      paymentMethods: result.rows,
      payment_methods: result.rows,
    });
    
  } catch (error: unknown) {
    console.error('Get payment methods error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

// POST - Save payment method after Stripe confirmation
export async function POST(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'billing_payment_method_write',
    limit: 20,
    windowMs: 60_000,
    userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'billing_payment_method_write');
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = paymentMethodPayloadSchema.safeParse(body);
    const paymentMethodId = parsed.success
      ? normalizePaymentMethodId(parsed.data.paymentMethodId) ||
        normalizePaymentMethodId(parsed.data.payment_method_id)
      : undefined;
    
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID required' },
        { status: 400 }
      );
    }
    
    // Get user's Stripe customer ID
    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
      return NextResponse.json(
        { error: 'Stripe customer not found' },
        { status: 400 }
      );
    }
    
    const customerId = userResult.rows[0].stripe_customer_id;
    
    // Retrieve and validate ownership before attachment/default updates.
    let pm = await getPaymentMethod(paymentMethodId);
    const attachedCustomerId =
      typeof pm.customer === 'string'
        ? pm.customer
        : pm.customer?.id || null;

    if (attachedCustomerId && attachedCustomerId !== customerId) {
      return NextResponse.json(
        { error: 'Payment method belongs to another Stripe customer' },
        { status: 409 }
      );
    }

    if (!attachedCustomerId) {
      await attachPaymentMethod(paymentMethodId, customerId);
      pm = await getPaymentMethod(paymentMethodId);
    }
    
    // Set as default
    await setDefaultPaymentMethod(customerId, paymentMethodId);
    
    // Remove previous default (if any)
    await pool.query(
      'UPDATE user_payment_methods SET is_default = false WHERE user_id = $1',
      [userId]
    );
    
    // Save to database
    const insertResult = await pool.query(
      `INSERT INTO user_payment_methods (
        user_id,
        stripe_customer_id,
        stripe_payment_method_id,
        payment_method_type,
        card_brand,
        card_last4,
        card_exp_month,
        card_exp_year,
        is_default,
        billing_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
      ON CONFLICT (stripe_payment_method_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        payment_method_type = EXCLUDED.payment_method_type,
        card_brand = EXCLUDED.card_brand,
        card_last4 = EXCLUDED.card_last4,
        card_exp_month = EXCLUDED.card_exp_month,
        card_exp_year = EXCLUDED.card_exp_year,
        is_default = true,
        billing_email = EXCLUDED.billing_email,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userId,
        customerId,
        paymentMethodId,
        pm.type,
        pm.card?.brand || null,
        pm.card?.last4 || null,
        pm.card?.exp_month || null,
        pm.card?.exp_year || null,
        pm.billing_details?.email || null
      ]
    );
    
    // Log event
    await pool.query(
      `INSERT INTO billing_events (
        user_id,
        event_type,
        event_data
      ) VALUES ($1, 'payment_method_added', $2)`,
      [userId, JSON.stringify({ paymentMethodId, cardBrand: pm.card?.brand, last4: pm.card?.last4 })]
    );
    
    // Enable billing for user
    await pool.query(
      'UPDATE users SET billing_enabled = true WHERE id = $1',
      [userId]
    );
    
    return NextResponse.json({
      success: true,
      paymentMethod: insertResult.rows[0],
      payment_method: insertResult.rows[0],
    });
    
  } catch (error: unknown) {
    console.error('Save payment method error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save payment method' },
      { status: 500 }
    );
  }
}

// DELETE - Remove payment method
export async function DELETE(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'billing_payment_method_write',
    limit: 20,
    windowMs: 60_000,
    userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'billing_payment_method_write');
  }
  
  try {
    const { searchParams } = new URL(request.url);
    let paymentMethodId = searchParams.get('id') || searchParams.get('paymentMethodId');

    if (!paymentMethodId) {
      const body = await request.json().catch(() => ({}));
      const parsed = paymentMethodPayloadSchema.safeParse(body);
      if (parsed.success) {
        paymentMethodId =
          normalizePaymentMethodId(parsed.data.paymentMethodId) ||
          normalizePaymentMethodId(parsed.data.payment_method_id) ||
          null;
      }
    }
    
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID required' },
        { status: 400 }
      );
    }
    
    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT user_id FROM user_payment_methods WHERE stripe_payment_method_id = $1',
      [paymentMethodId]
    );
    
    if (ownerCheck.rows.length === 0 || Number(ownerCheck.rows[0].user_id) !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    // Detach from Stripe
    await detachPaymentMethod(paymentMethodId);
    
    // Remove from database
    await pool.query(
      'DELETE FROM user_payment_methods WHERE stripe_payment_method_id = $1',
      [paymentMethodId]
    );
    
    // Disable billing if no payment methods left
    const remainingCheck = await pool.query(
      'SELECT COUNT(*) as count FROM user_payment_methods WHERE user_id = $1',
      [userId]
    );
    
    if (parseInt(remainingCheck.rows[0].count) === 0) {
      await pool.query(
        'UPDATE users SET billing_enabled = false WHERE id = $1',
        [userId]
      );
    }
    
    // Log event
    await pool.query(
      `INSERT INTO billing_events (
        user_id,
        event_type,
        event_data
      ) VALUES ($1, 'payment_method_removed', $2)`,
      [userId, JSON.stringify({ paymentMethodId })]
    );
    
    return NextResponse.json({ success: true });
    
  } catch (error: unknown) {
    console.error('Delete payment method error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete payment method' },
      { status: 500 }
    );
  }
}
