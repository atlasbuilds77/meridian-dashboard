/**
 * WEEKLY BILLING CRON JOB
 * 
 * Runs: Sunday 11:59 PM PST (every week)
 * Purpose: Calculate weekly P&L and charge 10% automation fee
 * 
 * Usage:
 *   node scripts/weekly-billing.ts
 *   OR via cron: 59 23 * * 0 (Sunday 11:59 PM)
 */

import { Pool } from 'pg';
import { chargeCustomer } from '../lib/stripe/client';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

interface User {
  id: number;
  discord_username: string;
  discord_email: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
}

interface WeeklyPnL {
  total_pnl: number;
  trade_count: number;
}

function getLastWeekDates(): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  
  // Last Monday
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - dayOfWeek - 6);
  lastMonday.setHours(0, 0, 0, 0);
  
  // Last Friday
  const lastFriday = new Date(lastMonday);
  lastFriday.setDate(lastMonday.getDate() + 4);
  lastFriday.setHours(23, 59, 59, 999);
  
  return {
    weekStart: lastMonday.toISOString().split('T')[0],
    weekEnd: lastFriday.toISOString().split('T')[0]
  };
}

async function calculateWeeklyPnL(userId: number, weekStart: string, weekEnd: string): Promise<WeeklyPnL> {
  const result = await pool.query(
    `SELECT 
      COALESCE(SUM(pnl), 0) as total_pnl,
      COUNT(*)::INTEGER as trade_count
    FROM trades
    WHERE user_id = $1
      AND entry_date >= $2
      AND entry_date <= $3
      AND status = 'closed'
      AND pnl IS NOT NULL`,
    [userId, weekStart, weekEnd]
  );
  
  return {
    total_pnl: parseFloat(result.rows[0].total_pnl),
    trade_count: parseInt(result.rows[0].trade_count)
  };
}

async function processUserBilling(user: User, weekStart: string, weekEnd: string): Promise<void> {
  console.log(`\n📊 Processing: ${user.discord_username} (ID: ${user.id})`);
  
  try {
    // Calculate P&L
    const pnl = await calculateWeeklyPnL(user.id, weekStart, weekEnd);
    
    console.log(`   Trades: ${pnl.trade_count}`);
    console.log(`   Total P&L: $${pnl.total_pnl.toFixed(2)}`);
    
    // Calculate fee (10%)
    const feeAmount = pnl.total_pnl > 0 ? pnl.total_pnl * 0.10 : 0;
    
    console.log(`   Fee (10%): $${feeAmount.toFixed(2)}`);
    
    // Create billing period record
    const periodResult = await pool.query(
      `INSERT INTO billing_periods (
        user_id,
        week_start,
        week_end,
        total_pnl,
        fee_amount,
        fee_percentage,
        status
      ) VALUES ($1, $2, $3, $4, $5, 10.00, $6)
      ON CONFLICT (user_id, week_start, week_end) DO UPDATE
      SET total_pnl = EXCLUDED.total_pnl,
          fee_amount = EXCLUDED.fee_amount
      RETURNING id`,
      [user.id, weekStart, weekEnd, pnl.total_pnl, feeAmount, feeAmount > 0 ? 'pending' : 'waived']
    );
    
    const periodId = periodResult.rows[0].id;
    
    // Log event
    await pool.query(
      `INSERT INTO billing_events (
        user_id,
        billing_period_id,
        event_type,
        event_data
      ) VALUES ($1, $2, 'period_created', $3)`,
      [user.id, periodId, JSON.stringify({ totalPnL: pnl.total_pnl, feeAmount, tradeCount: pnl.trade_count })]
    );
    
    // If no fee, skip charging
    if (feeAmount <= 0) {
      console.log(`   ✅ No fee (losing/break-even week)`);
      return;
    }
    
    // Attempt to charge
    console.log(`   💳 Charging $${feeAmount.toFixed(2)}...`);
    
    try {
      const paymentIntent = await chargeCustomer({
        customerId: user.stripe_customer_id,
        paymentMethodId: user.stripe_payment_method_id,
        amount: Math.round(feeAmount * 100), // Convert to cents
        description: `Meridian Automation Fee - Week ${weekStart} to ${weekEnd}`,
        metadata: {
          userId: user.id.toString(),
          billingPeriodId: periodId.toString(),
          weekStart,
          weekEnd,
          totalPnL: pnl.total_pnl.toString(),
          feePercentage: '10'
        }
      });
      
      // Update billing period
      await pool.query(
        `UPDATE billing_periods 
        SET status = 'paid',
            stripe_payment_intent_id = $1,
            paid_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [paymentIntent.id, periodId]
      );
      
      // Record payment
      await pool.query(
        `INSERT INTO payments (
          user_id,
          billing_period_id,
          amount,
          stripe_payment_intent_id,
          stripe_charge_id,
          payment_method_id,
          status,
          receipt_url
        ) VALUES ($1, $2, $3, $4, $5, $6, 'succeeded', $7)`,
        [
          user.id,
          periodId,
          feeAmount,
          paymentIntent.id,
          paymentIntent.latest_charge,
          user.stripe_payment_method_id,
          paymentIntent.charges?.data[0]?.receipt_url || null
        ]
      );
      
      // Log success
      await pool.query(
        `INSERT INTO billing_events (
          user_id,
          billing_period_id,
          event_type,
          event_data
        ) VALUES ($1, $2, 'charge_succeeded', $3)`,
        [user.id, periodId, JSON.stringify({ paymentIntentId: paymentIntent.id, amount: feeAmount })]
      );
      
      console.log(`   ✅ Payment succeeded: ${paymentIntent.id}`);
      
    } catch (chargeError: any) {
      console.error(`   ❌ Payment failed: ${chargeError.message}`);
      
      // Update billing period
      await pool.query(
        `UPDATE billing_periods 
        SET status = 'failed',
            attempt_count = attempt_count + 1,
            last_attempt_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [periodId]
      );
      
      // Record failed payment
      await pool.query(
        `INSERT INTO payments (
          user_id,
          billing_period_id,
          amount,
          payment_method_id,
          status,
          failure_reason
        ) VALUES ($1, $2, $3, $4, 'failed', $5)`,
        [user.id, periodId, feeAmount, user.stripe_payment_method_id, chargeError.message]
      );
      
      // Log failure
      await pool.query(
        `INSERT INTO billing_events (
          user_id,
          billing_period_id,
          event_type,
          event_data
        ) VALUES ($1, $2, 'charge_failed', $3)`,
        [user.id, periodId, JSON.stringify({ error: chargeError.message, amount: feeAmount })]
      );
      
      // TODO: Send notification to user about failed payment
    }
    
  } catch (error: any) {
    console.error(`   ❌ Error processing ${user.discord_username}:`, error.message);
  }
}

async function runWeeklyBilling() {
  console.log('🔄 WEEKLY BILLING CRON - Starting');
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  
  try {
    // Get last week's date range
    const { weekStart, weekEnd } = getLastWeekDates();
    console.log(`\n📅 Week: ${weekStart} to ${weekEnd}`);
    
    // Get all users with billing enabled
    const usersResult = await pool.query(
      `SELECT 
        u.id,
        u.discord_username,
        u.discord_email,
        u.stripe_customer_id,
        upm.stripe_payment_method_id
      FROM users u
      JOIN user_payment_methods upm ON upm.user_id = u.id AND upm.is_default = true
      WHERE u.billing_enabled = true
        AND u.stripe_customer_id IS NOT NULL`
    );
    
    const users: User[] = usersResult.rows;
    
    console.log(`\n👥 Found ${users.length} users with billing enabled`);
    
    if (users.length === 0) {
      console.log('✅ No users to process. Exiting.');
      return;
    }
    
    // Process each user
    for (const user of users) {
      await processUserBilling(user, weekStart, weekEnd);
    }
    
    console.log('\n✅ Weekly billing completed successfully');
    
  } catch (error: any) {
    console.error('❌ Weekly billing failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runWeeklyBilling()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { runWeeklyBilling, getLastWeekDates, calculateWeeklyPnL };
