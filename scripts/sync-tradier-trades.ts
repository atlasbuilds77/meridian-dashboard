#!/usr/bin/env npx tsx
/**
 * Sync Tradier Trade History
 * 
 * Pulls completed trades from Tradier API for all users and syncs to database.
 * 
 * IMPORTANT: Tradier history API returns individual transactions (buys/sells separately),
 * NOT matched entry/exit pairs. This script imports them as individual records that
 * can be manually matched or used for audit purposes.
 * 
 * For proper P&L tracking, use the gain/loss endpoint or manual entry.
 * 
 * Usage:
 *   npx tsx scripts/sync-tradier-trades.ts
 *   npx tsx scripts/sync-tradier-trades.ts --dry-run  # Preview without inserting
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

interface TradierTradeEvent {
  amount: number;
  date: string;
  type: 'trade' | 'dividend' | 'option' | 'journal';
  trade?: {
    commission: number;
    description: string;
    price: number;
    quantity: number;
    symbol: string;
    trade_type: 'Equity' | 'Option';
  };
}

interface TradierHistoryResponse {
  history?: {
    event?: TradierTradeEvent | TradierTradeEvent[];
  } | null;
}

interface User {
  id: number;
  username: string;
  tradier_account_number: string;
  tradier_token: string;
}

async function syncTrades() {
  console.log('🔄 Starting Tradier trade sync...');
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  console.log('');

  const client = await pool.connect();
  
  try {
    // Get all users with Tradier credentials
    const usersResult = await client.query<User>(`
      SELECT id, username, tradier_account_number, tradier_token 
      FROM users 
      WHERE tradier_account_number IS NOT NULL 
        AND tradier_token IS NOT NULL
    `);

    const users = usersResult.rows;

    if (users.length === 0) {
      console.log('ℹ️  No users with Tradier credentials found');
      return;
    }

    console.log(`📊 Found ${users.length} users with Tradier accounts\n`);

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const user of users) {
      console.log(`\n🔍 Syncing trades for ${user.username || 'User'} (${user.tradier_account_number})...`);

      try {
        // Fetch trade history from Tradier
        const response = await fetch(
          `https://api.tradier.com/v1/accounts/${user.tradier_account_number}/history`,
          {
            headers: {
              'Authorization': `Bearer ${user.tradier_token}`,
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          console.error(`   ❌ Tradier API error (${response.status}): ${response.statusText}`);
          if (response.status === 401) {
            console.error('      Token may be expired - user needs to re-authenticate');
          }
          totalErrors++;
          continue;
        }

        const data: TradierHistoryResponse = await response.json();
        
        // Handle empty history
        if (!data.history || !data.history.event) {
          console.log('   ℹ️  No trade history found');
          continue;
        }

        // Normalize to array (Tradier returns single object if only one event)
        const events: TradierTradeEvent[] = Array.isArray(data.history.event) 
          ? data.history.event 
          : [data.history.event];

        console.log(`   📈 Found ${events.length} history events`);

        // Filter for actual trades (not dividends, journals, etc.)
        const tradeEvents = events.filter((event): event is TradierTradeEvent & { trade: NonNullable<TradierTradeEvent['trade']> } => 
          event.type === 'trade' && event.trade !== undefined
        );

        console.log(`   📊 ${tradeEvents.length} trade transactions`);

        let synced = 0;
        let skipped = 0;

        for (const event of tradeEvents) {
          const trade = event.trade;
          
          // Create a unique ID from the event data
          // Tradier doesn't provide a unique trade ID, so we create one from the data
          const tradierTradeId = `${user.tradier_account_number}_${event.date}_${trade.symbol}_${trade.quantity}_${trade.price}`;
          
          // Check if trade already exists
          const existingResult = await client.query(
            'SELECT id FROM trades WHERE tradier_trade_id = $1',
            [tradierTradeId]
          );

          if (existingResult.rows.length > 0) {
            skipped++;
            continue;
          }

          // Determine direction and asset type
          const isOption = trade.trade_type === 'Option';
          const isBuy = trade.quantity > 0;
          
          // For options, try to parse symbol for CALL/PUT
          let direction: 'LONG' | 'SHORT' | 'CALL' | 'PUT';
          if (isOption) {
            // Option symbols typically have C or P followed by strike
            // e.g., GE180622C00014000 (C for call, P for put)
            const callMatch = trade.symbol.match(/C\d{8}$/);
            const putMatch = trade.symbol.match(/P\d{8}$/);
            direction = callMatch ? 'CALL' : putMatch ? 'PUT' : (isBuy ? 'CALL' : 'PUT');
          } else {
            direction = isBuy ? 'LONG' : 'SHORT';
          }

          const quantity = Math.abs(trade.quantity);

          if (DRY_RUN) {
            console.log(`   [DRY RUN] Would insert: ${trade.symbol} ${direction} ${quantity}x @ $${trade.price}`);
            synced++;
          } else {
            try {
              await client.query(`
                INSERT INTO trades (
                  user_id, tradier_trade_id, symbol, direction, asset_type,
                  entry_price, exit_price, quantity, pnl, pnl_percent,
                  status, entry_date, exit_date, notes, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              `, [
                user.id,
                tradierTradeId,
                trade.symbol,
                direction,
                isOption ? 'option' : 'stock',
                trade.price,
                null, // exit_price - will be set when trade is closed
                quantity,
                null, // pnl
                null, // pnl_percent
                'imported', // status - needs matching
                new Date(event.date),
                null, // exit_date
                `Imported from Tradier: ${trade.description}`,
                new Date()
              ]);
              synced++;
            } catch (insertError: unknown) {
              const errorMessage = insertError instanceof Error ? insertError.message : String(insertError);
              console.error(`   ❌ Error inserting trade:`, errorMessage);
              totalErrors++;
            }
          }
        }

        console.log(`   ✅ Synced: ${synced}, Skipped (duplicates): ${skipped}`);
        totalSynced += synced;
        totalSkipped += skipped;

      } catch (error) {
        console.error(`   ❌ Error syncing user:`, error instanceof Error ? error.message : error);
        totalErrors++;
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('📊 SYNC SUMMARY');
    console.log('═'.repeat(50));
    console.log(`   Total synced:  ${totalSynced}`);
    console.log(`   Total skipped: ${totalSkipped}`);
    console.log(`   Total errors:  ${totalErrors}`);
    console.log('═'.repeat(50));
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - No changes were made');
      console.log('   Remove --dry-run to actually sync trades');
    } else {
      console.log('\n✅ Trade sync complete!');
      console.log('\nℹ️  Note: Imported trades have status "imported" and need to be');
      console.log('   matched with exit transactions to calculate P&L.');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

syncTrades().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
