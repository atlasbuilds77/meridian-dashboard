import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';
import { 
  attachPaymentMethod, 
  setDefaultPaymentMethod, 
  getPaymentMethod,
  detachPaymentMethod 
} from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

// GET - Get user's payment methods
export async function GET(request: Request) {
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
      paymentMethods: result.rows
    });
    
  } catch (error) {
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
  
  try {
    const { paymentMethodId } = await request.json();
    
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
    
    // Attach payment method to customer
    await attachPaymentMethod(paymentMethodId, customerId);
    
    // Set as default
    await setDefaultPaymentMethod(customerId, paymentMethodId);
    
    // Get payment method details from Stripe
    const pm = await getPaymentMethod(paymentMethodId);
    
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
      paymentMethod: insertResult.rows[0]
    });
    
  } catch (error: any) {
    console.error('Save payment method error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save payment method' },
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
  
  try {
    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get('id');
    
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
    
    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== userId) {
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
    
  } catch (error: any) {
    console.error('Delete payment method error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete payment method' },
      { status: 500 }
    );
  }
}
