/**
 * WEEKLY BILLING CRON JOB
 * 
 * Runs: Sunday 11:59 PM PST (every week)
 * Purpose: Calculate weekly P&L and charge 10% automation fee
 * 
 * Usage:
 *   BILLING_ENABLED=true node scripts/weekly-billing.ts
 *   OR via cron: 59 23 * * 0 (Sunday 11:59 PM)
 * 
 * SAFETY: Billing disabled by default. Set BILLING_ENABLED=true to run.
 */

import { Pool } from 'pg';
import { chargeCustomer } from '../lib/stripe/client';

const DATABASE_URL = process.env.DATABASE_URL;
const BILLING_ENABLED = process.env.BILLING_ENABLED === 'true';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

if (!BILLING_ENABLED) {
  console.log('⚠️  BILLING DISABLED - Set BILLING_ENABLED=true to enable');
  console.log('   This is intentional to prevent charging on incomplete data.');
  process.exit(0);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

interface User {
  id: number;
  username: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
}

interface WeeklyPnL {
  total_pnl: number;
  trade_count: number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Get last trading week dates (Monday through Friday ONLY)
 * Weekend trades are excluded from billing
 */
function getLastWeekDates(): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  
  // Last Monday (most recent Monday before today)
  const lastMonday = new Date(today);
  // If today is Sunday (0), go back 6 days; if Monday (1), go back 7; etc
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6;
  lastMonday.setDate(today.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);
  
  // Last Friday (4 days after last Monday)
  const lastFriday = new Date(lastMonday);
  lastFriday.setDate(lastMonday.getDate() + 4);
  lastFriday.setHours(23, 59, 59, 999);
  
  return {
    weekStart: lastMonday.toISOString().split('T')[0],
    weekEnd: lastFriday.toISOString().split('T')[0]
  };
}

/**
 * Calculate weekly P&L for a user
 * - Only includes Monday-Friday trades (excludes weekends)
 * - Uses dynamic P&L calculation when stored pnl is NULL
 */
async function calculateWeeklyPnL(userId: number, weekStart: string, weekEnd: string): Promise<WeeklyPnL> {
  const result = await pool.query(
    `WITH trades_with_pnl AS (
      SELECT 
        COALESCE(
          pnl,
          CASE
            WHEN exit_price IS NULL THEN NULL
            WHEN UPPER(direction) IN ('LONG', 'CALL')
              THEN (exit_price - entry_price) * quantity * 
                   CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
            WHEN UPPER(direction) IN ('SHORT', 'PUT')
              THEN (entry_price - exit_price) * quantity * 
                   CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
            ELSE NULL
          END
        ) AS calculated_pnl
      FROM trades
      WHERE user_id = $1
        AND entry_date >= $2
        AND entry_date < ($3::date + INTERVAL '1 day')
        AND EXTRACT(DOW FROM entry_date) BETWEEN 1 AND 5  -- Mon=1 to Fri=5 only
        AND status = 'closed'
    )
    SELECT 
      COALESCE(SUM(calculated_pnl), 0) as total_pnl,
      COUNT(*) FILTER (WHERE calculated_pnl IS NOT NULL)::INTEGER as trade_count
    FROM trades_with_pnl`,
    [userId, weekStart, weekEnd]
  );
  
  return {
    total_pnl: parseFloat(result.rows[0].total_pnl),
    trade_count: parseInt(result.rows[0].trade_count)
  };
}

async function processUserBilling(user: User, weekStart: string, weekEnd: string): Promise<void> {
  console.log(`\n📊 Processing: ${user.username} (ID: ${user.id})`);
  
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
          null
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
      
    } catch (chargeError: unknown) {
      const chargeErrorMessage = getErrorMessage(chargeError);
      console.error(`   ❌ Payment failed: ${chargeErrorMessage}`);
      
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
        [user.id, periodId, feeAmount, user.stripe_payment_method_id, chargeErrorMessage]
      );
      
      // Log failure
      await pool.query(
        `INSERT INTO billing_events (
          user_id,
          billing_period_id,
          event_type,
          event_data
        ) VALUES ($1, $2, 'charge_failed', $3)`,
        [user.id, periodId, JSON.stringify({ error: chargeErrorMessage, amount: feeAmount })]
      );
      
      // TODO: Send notification to user about failed payment
    }
    
  } catch (error: unknown) {
    console.error(`   ❌ Error processing ${user.username}:`, getErrorMessage(error));
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
        u.username,
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
    
  } catch (error: unknown) {
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
