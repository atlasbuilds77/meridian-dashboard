#!/usr/bin/env npx tsx
/**
 * TRADIER GAIN/LOSS SYNC (SOURCE OF TRUTH)
 * 
 * This script syncs ACTUAL P&L from Tradier's /gainloss endpoint.
 * This is the authoritative source for all P&L data.
 * 
 * The old sync-tradier-trades.ts used /history which only has individual
 * transactions without P&L. This script uses /gainloss which has the
 * actual closed position P&L calculated by Tradier.
 * 
 * Usage:
 *   npx tsx scripts/sync-tradier-gainloss.ts
 *   npx tsx scripts/sync-tradier-gainloss.ts --dry-run
 *   npx tsx scripts/sync-tradier-gainloss.ts --user-id=123
 *   npx tsx scripts/sync-tradier-gainloss.ts --fix-missing  # Fix trades with null P&L
 * 
 * Cron: 0 6 * * * (6 AM daily - after Tradier's nightly batch)
 */

import { Pool } from 'pg';
import {
  fetchAllTradierGainLoss,
  positionToTrade,
  createPositionId,
  validateTradePnl,
  TradierClosedPosition,
} from '../lib/api-clients/tradier-gainloss';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const FIX_MISSING = process.argv.includes('--fix-missing');
const USER_ID_ARG = process.argv.find(arg => arg.startsWith('--user-id='));
const TARGET_USER_ID = USER_ID_ARG ? parseInt(USER_ID_ARG.split('=')[1], 10) : null;

interface UserCredentials {
  id: number;
  username: string;
  account_number: string;
  access_token: string;
}

interface SyncStats {
  userId: number;
  username: string;
  synced: number;
  updated: number;
  skipped: number;
  errors: number;
  totalPnl: number;
}

/**
 * Get all users with Tradier credentials
 */
async function getUsersWithTradier(): Promise<UserCredentials[]> {
  const query = TARGET_USER_ID
    ? `SELECT u.id, u.username, ac.account_number, ac.access_token
       FROM users u
       JOIN api_credentials ac ON ac.user_id = u.id
       WHERE ac.platform = 'tradier'
         AND ac.access_token IS NOT NULL
         AND ac.account_number IS NOT NULL
         AND u.id = $1`
    : `SELECT u.id, u.username, ac.account_number, ac.access_token
       FROM users u
       JOIN api_credentials ac ON ac.user_id = u.id
       WHERE ac.platform = 'tradier'
         AND ac.access_token IS NOT NULL
         AND ac.account_number IS NOT NULL`;

  const result = await pool.query(query, TARGET_USER_ID ? [TARGET_USER_ID] : []);
  return result.rows;
}

/**
 * Check if a position already exists in the database
 */
async function positionExists(positionId: string): Promise<{ exists: boolean; tradeId?: number; hasNullPnl?: boolean }> {
  const result = await pool.query(
    `SELECT id, pnl FROM trades WHERE tradier_position_id = $1`,
    [positionId]
  );
  
  if (result.rows.length === 0) {
    return { exists: false };
  }
  
  return {
    exists: true,
    tradeId: result.rows[0].id,
    hasNullPnl: result.rows[0].pnl === null,
  };
}

/**
 * Insert a new trade from Tradier position
 */
async function insertTrade(trade: ReturnType<typeof positionToTrade>): Promise<number> {
  const result = await pool.query(
    `INSERT INTO trades (
      user_id, tradier_position_id, symbol, direction, asset_type,
      strike, expiry, entry_price, exit_price, quantity,
      entry_date, exit_date, pnl, pnl_percent, status, notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
    RETURNING id`,
    [
      trade.user_id,
      trade.tradier_position_id,
      trade.symbol,
      trade.direction,
      trade.asset_type,
      trade.strike,
      trade.expiry,
      trade.entry_price,
      trade.exit_price,
      trade.quantity,
      trade.entry_date,
      trade.exit_date,
      trade.pnl,
      trade.pnl_percent,
      trade.status,
      trade.notes,
    ]
  );
  
  return result.rows[0].id;
}

/**
 * Update an existing trade's P&L from Tradier
 */
async function updateTradePnl(
  tradeId: number,
  pnl: number,
  pnlPercent: number,
  exitPrice: number,
  notes: string
): Promise<void> {
  await pool.query(
    `UPDATE trades
     SET pnl = $1, pnl_percent = $2, exit_price = $3, notes = $4, updated_at = NOW()
     WHERE id = $5`,
    [pnl, pnlPercent, exitPrice, notes, tradeId]
  );
}

/**
 * Sync a single user's trades from Tradier
 */
async function syncUserTrades(user: UserCredentials): Promise<SyncStats> {
  const stats: SyncStats = {
    userId: user.id,
    username: user.username,
    synced: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    totalPnl: 0,
  };

  console.log(`\n🔄 Syncing: ${user.username} (Account: ${user.account_number})`);

  try {
    // Fetch all closed positions from Tradier
    const positions = await fetchAllTradierGainLoss(
      user.account_number,
      user.access_token
    );

    console.log(`   📊 Found ${positions.length} closed positions in Tradier`);

    for (const position of positions) {
      const positionId = createPositionId(position, user.account_number);
      
      try {
        // Check if already exists
        const existing = await positionExists(positionId);

        if (existing.exists && !existing.hasNullPnl) {
          // Already synced with P&L
          stats.skipped++;
          continue;
        }

        // Convert to trade format
        const trade = positionToTrade(position, user.id, user.account_number);

        // Validate P&L makes sense
        const validationError = validateTradePnl(trade);
        if (validationError) {
          console.warn(`   ⚠️  ${position.symbol}: ${validationError}`);
          // Still sync - Tradier is source of truth, but log the discrepancy
        }

        if (DRY_RUN) {
          if (existing.exists && existing.hasNullPnl) {
            console.log(`   [DRY RUN] Would UPDATE: ${trade.symbol} P&L=${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`);
            stats.updated++;
          } else {
            console.log(`   [DRY RUN] Would INSERT: ${trade.symbol} P&L=${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`);
            stats.synced++;
          }
        } else {
          if (existing.exists && existing.hasNullPnl) {
            // Update existing trade with P&L from Tradier
            await updateTradePnl(
              existing.tradeId!,
              trade.pnl,
              trade.pnl_percent,
              trade.exit_price,
              trade.notes
            );
            console.log(`   ✅ Updated: ${trade.symbol} P&L=${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`);
            stats.updated++;
          } else {
            // Insert new trade
            const tradeId = await insertTrade(trade);
            console.log(`   ✅ Synced: ${trade.symbol} (ID: ${tradeId}) P&L=${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`);
            stats.synced++;
          }
        }

        stats.totalPnl += trade.pnl;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Error processing ${position.symbol}: ${errorMsg}`);
        stats.errors++;
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ API Error: ${errorMsg}`);
    
    if (errorMsg.includes('401')) {
      console.error(`      Token expired - user needs to re-authenticate`);
    }
    
    stats.errors++;
  }

  return stats;
}

/**
 * Fix trades that were imported without P&L by matching against Tradier
 */
async function fixMissingPnlTrades(): Promise<void> {
  console.log('\n🔧 FIX MODE: Finding trades with missing P&L...\n');

  // Find all trades with null P&L that have exit_price (should have P&L calculated)
  const brokenTrades = await pool.query(`
    SELECT t.id, t.user_id, t.symbol, t.entry_price, t.exit_price, t.quantity,
           t.direction, t.asset_type, t.entry_date, t.exit_date,
           u.username, ac.account_number, ac.access_token
    FROM trades t
    JOIN users u ON u.id = t.user_id
    JOIN api_credentials ac ON ac.user_id = t.user_id AND ac.platform = 'tradier'
    WHERE t.pnl IS NULL
      AND t.exit_price IS NOT NULL
      AND t.status = 'closed'
    ORDER BY t.user_id, t.entry_date DESC
  `);

  console.log(`   Found ${brokenTrades.rows.length} trades with missing P&L\n`);

  if (brokenTrades.rows.length === 0) {
    console.log('   ✅ No broken trades found!');
    return;
  }

  // Group by user to batch API calls
  const userTrades = new Map<number, typeof brokenTrades.rows>();
  for (const trade of brokenTrades.rows) {
    if (!userTrades.has(trade.user_id)) {
      userTrades.set(trade.user_id, []);
    }
    userTrades.get(trade.user_id)!.push(trade);
  }

  for (const [userId, trades] of Array.from(userTrades.entries())) {
    const user = trades[0];
    console.log(`\n🔍 Fixing ${trades.length} trades for ${user.username}...`);

    try {
      // Fetch all gain/loss from Tradier
      const positions = await fetchAllTradierGainLoss(
        user.account_number,
        user.access_token
      );

      console.log(`   📊 Fetched ${positions.length} positions from Tradier`);

      // Create lookup map by symbol + dates
      const positionMap = new Map<string, TradierClosedPosition>();
      for (const pos of positions) {
        // Multiple keys for matching flexibility
        const keys = [
          `${pos.symbol}_${pos.open_date}_${pos.close_date}`,
          `${pos.symbol}_${pos.open_date.split('T')[0]}_${pos.close_date.split('T')[0]}`,
          pos.symbol, // Fallback to just symbol for unique recent trades
        ];
        for (const key of keys) {
          if (!positionMap.has(key)) {
            positionMap.set(key, pos);
          }
        }
      }

      let fixed = 0;
      let notFound = 0;

      for (const trade of trades) {
        // Try to match with Tradier position
        const entryDate = new Date(trade.entry_date).toISOString().split('T')[0];
        const exitDate = trade.exit_date ? new Date(trade.exit_date).toISOString().split('T')[0] : null;

        let matchedPosition: TradierClosedPosition | undefined;

        // Try exact match first
        if (exitDate) {
          matchedPosition = positionMap.get(`${trade.symbol}_${entryDate}_${exitDate}`);
        }

        // Fall back to symbol-only match for recent trades
        if (!matchedPosition) {
          matchedPosition = positionMap.get(trade.symbol);
        }

        if (matchedPosition) {
          const pnl = matchedPosition.gain_loss;
          const pnlPercent = matchedPosition.gain_loss_percent;
          const exitPrice = matchedPosition.proceeds / matchedPosition.quantity;

          if (DRY_RUN) {
            console.log(`   [DRY RUN] Would fix ${trade.symbol}: P&L=${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
          } else {
            await updateTradePnl(
              trade.id,
              pnl,
              pnlPercent,
              exitPrice,
              `P&L fixed from Tradier gainloss | Original entry: $${trade.entry_price}`
            );
            console.log(`   ✅ Fixed ${trade.symbol}: P&L=${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
          }
          fixed++;
        } else {
          console.log(`   ⚠️  No Tradier match for ${trade.symbol} (${entryDate})`);
          
          // Calculate P&L ourselves as fallback
          const multiplier = trade.asset_type === 'option' ? 100 : 1;
          const isLong = ['LONG', 'CALL'].includes(trade.direction);
          const priceDiff = trade.exit_price - trade.entry_price;
          const calculatedPnl = isLong
            ? priceDiff * trade.quantity * multiplier
            : -priceDiff * trade.quantity * multiplier;
          const calculatedPnlPercent = (priceDiff / trade.entry_price) * 100 * (isLong ? 1 : -1);

          if (DRY_RUN) {
            console.log(`   [DRY RUN] Would calculate ${trade.symbol}: P&L=${calculatedPnl >= 0 ? '+' : ''}$${calculatedPnl.toFixed(2)}`);
          } else {
            await updateTradePnl(
              trade.id,
              calculatedPnl,
              calculatedPnlPercent,
              trade.exit_price,
              `P&L calculated (no Tradier match) | Entry: $${trade.entry_price}, Exit: $${trade.exit_price}`
            );
            console.log(`   ⚡ Calculated ${trade.symbol}: P&L=${calculatedPnl >= 0 ? '+' : ''}$${calculatedPnl.toFixed(2)}`);
          }
          notFound++;
        }
      }

      console.log(`   📊 Fixed: ${fixed}, Calculated: ${notFound}`);

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  }
}

/**
 * Record sync status in database for monitoring
 */
async function recordSyncStatus(
  success: boolean,
  stats: { totalUsers: number; totalSynced: number; totalErrors: number; totalPnl: number }
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO sync_status (
        sync_type, success, users_processed, trades_synced, errors, total_pnl, synced_at
      ) VALUES ('tradier_gainloss', $1, $2, $3, $4, $5, NOW())
      ON CONFLICT (sync_type) DO UPDATE SET
        success = $1,
        users_processed = $2,
        trades_synced = $3,
        errors = $4,
        total_pnl = $5,
        synced_at = NOW()`,
      [success, stats.totalUsers, stats.totalSynced, stats.totalErrors, stats.totalPnl]
    );
  } catch (error) {
    // Table might not exist yet - that's OK
    console.warn('   ⚠️  Could not record sync status (table may not exist)');
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('  TRADIER GAIN/LOSS SYNC');
  console.log('  Source of truth: Tradier /gainloss endpoint');
  console.log('═'.repeat(60));
  console.log(`  Time: ${new Date().toISOString()}`);
  
  if (DRY_RUN) {
    console.log('  Mode: DRY RUN (no changes)');
  }
  if (FIX_MISSING) {
    console.log('  Mode: FIX MISSING P&L');
  }
  if (TARGET_USER_ID) {
    console.log(`  Target: User ID ${TARGET_USER_ID}`);
  }
  
  console.log('═'.repeat(60));

  try {
    // Fix missing P&L mode
    if (FIX_MISSING) {
      await fixMissingPnlTrades();
      console.log('\n✅ Fix missing P&L complete!');
      return;
    }

    // Normal sync mode
    const users = await getUsersWithTradier();

    if (users.length === 0) {
      console.log('\n⚠️  No users with Tradier credentials found');
      return;
    }

    console.log(`\n👥 Found ${users.length} users with Tradier accounts`);

    const allStats: SyncStats[] = [];

    for (const user of users) {
      const stats = await syncUserTrades(user);
      allStats.push(stats);
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('  SYNC SUMMARY');
    console.log('═'.repeat(60));

    let totalSynced = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let grandTotalPnl = 0;

    for (const stats of allStats) {
      totalSynced += stats.synced;
      totalUpdated += stats.updated;
      totalSkipped += stats.skipped;
      totalErrors += stats.errors;
      grandTotalPnl += stats.totalPnl;

      const pnlStr = stats.totalPnl >= 0 ? `+$${stats.totalPnl.toFixed(2)}` : `-$${Math.abs(stats.totalPnl).toFixed(2)}`;
      console.log(`  ${stats.username}: Synced ${stats.synced}, Updated ${stats.updated}, Skipped ${stats.skipped}, Errors ${stats.errors} | P&L: ${pnlStr}`);
    }

    console.log('─'.repeat(60));
    console.log(`  TOTAL: Synced ${totalSynced}, Updated ${totalUpdated}, Skipped ${totalSkipped}, Errors ${totalErrors}`);
    console.log(`  COMBINED P&L: ${grandTotalPnl >= 0 ? '+' : ''}$${grandTotalPnl.toFixed(2)}`);
    console.log('═'.repeat(60));

    // Record status for monitoring
    await recordSyncStatus(totalErrors === 0, {
      totalUsers: users.length,
      totalSynced: totalSynced + totalUpdated,
      totalErrors,
      totalPnl: grandTotalPnl,
    });

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - No changes were made');
      console.log('   Remove --dry-run to actually sync trades');
    } else {
      console.log('\n✅ Sync complete!');
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    await recordSyncStatus(false, { totalUsers: 0, totalSynced: 0, totalErrors: 1, totalPnl: 0 });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
