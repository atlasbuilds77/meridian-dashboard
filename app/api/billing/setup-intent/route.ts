import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';
import { stripe, createCustomer, createSetupIntent } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

// POST - Create Stripe SetupIntent for adding payment method
export async function POST(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get user info
    const userResult = await pool.query(
      'SELECT discord_email, discord_username, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = userResult.rows[0];
    let customerId = user.stripe_customer_id;
    
    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await createCustomer({
        email: user.discord_email || `user-${userId}@meridian.temp`,
        name: user.discord_username || `User ${userId}`,
        metadata: {
          userId: userId.toString(),
          source: 'meridian_dashboard'
        }
      });
      
      customerId = customer.id;
      
      // Save customer ID to database
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
    }
    
    // Create SetupIntent
    const setupIntent = await createSetupIntent(customerId);
    
    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customerId
    });
    
  } catch (error: any) {
    console.error('Setup intent error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create setup intent' },
      { status: 500 }
    );
  }
}
