#!/usr/bin/env npx tsx
/**
 * Sync Tradier Trade History
 * 
 * Pulls completed trades from Tradier API for all users and syncs to database.
 * Deduplicates using tradier_trade_id column.
 * 
 * Usage:
 *   npx tsx scripts/sync-tradier-trades.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TradierPosition {
  id: number;
  symbol: string;
  quantity: number;
  cost_basis: number;
  date_acquired: string;
}

async function syncTrades() {
  console.log('🔄 Starting Tradier trade sync...\n');

  // Get all users with Tradier credentials
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, tradier_account_number, tradier_token')
    .not('tradier_account_number', 'is', null)
    .not('tradier_token', 'is', null);

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  console.log(`📊 Found ${users.length} users with Tradier accounts\n`);

  for (const user of users) {
    console.log(`\n🔍 Syncing trades for user ${user.id} (${user.tradier_account_number})...`);

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
        console.error(`❌ Tradier API error: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const events = data.history?.event || [];

      if (!Array.isArray(events)) {
        console.log('  ℹ️  No trade history found');
        continue;
      }

      console.log(`  📈 Found ${events.length} events`);

      // Filter for closed trades
      const closedTrades = events.filter((event: any) => 
        event.type === 'trade' && 
        event.trade?.close_price
      );

      console.log(`  ✅ ${closedTrades.length} closed trades to sync`);

      let synced = 0;
      let skipped = 0;

      for (const event of closedTrades) {
        const trade = event.trade;
        
        // Calculate P&L
        const quantity = Math.abs(trade.quantity);
        const costBasis = trade.price * quantity * 100; // Options are x100 multiplier
        const proceeds = trade.close_price * quantity * 100;
        const pnl = proceeds - costBasis;
        const pnlPercent = (pnl / costBasis) * 100;

        // Check if trade already exists
        const { data: existing } = await supabase
          .from('trades')
          .select('id')
          .eq('tradier_trade_id', trade.id)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Insert trade
        const { error: insertError } = await supabase
          .from('trades')
          .insert({
            user_id: user.id,
            tradier_trade_id: trade.id,
            symbol: trade.symbol,
            setup: 'IMPORTED',
            direction: trade.side === 'buy' ? 'BULL' : 'BEAR',
            entry_price: trade.price,
            exit_price: trade.close_price,
            quantity: quantity,
            pnl: pnl,
            pnl_percent: pnlPercent,
            status: 'closed',
            entry_time: new Date(event.date),
            exit_time: new Date(event.date), // Tradier doesn't separate entry/exit times
            created_at: new Date()
          });

        if (insertError) {
          console.error(`  ❌ Error inserting trade ${trade.id}:`, insertError);
        } else {
          synced++;
        }
      }

      console.log(`  ✅ Synced: ${synced}, Skipped (duplicates): ${skipped}`);

    } catch (error) {
      console.error(`❌ Error syncing user ${user.id}:`, error);
    }
  }

  console.log('\n✅ Trade sync complete!');
}

syncTrades().catch(console.error);
