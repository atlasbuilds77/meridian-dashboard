/**
 * Migration: Add kraken_trades + bot_heartbeats tables
 * Run: node scripts/migrate-kraken-tables.js
 */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running kraken tables migration...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS kraken_trades (
        id           SERIAL PRIMARY KEY,
        bot          VARCHAR(20) NOT NULL,           -- 'zeus' or 'kronos'
        pair         VARCHAR(20) NOT NULL,           -- 'BTC-USD', 'ETH-USD'
        direction    VARCHAR(10),                    -- 'long', 'short', 'grid_fill'
        entry_price  NUMERIC(18,8) NOT NULL,
        exit_price   NUMERIC(18,8),
        size         NUMERIC(18,8) NOT NULL,         -- base currency size
        leverage     INTEGER DEFAULT 1,
        pnl_usd      NUMERIC(10,4),
        pnl_pct      NUMERIC(8,4),
        exit_reason  VARCHAR(50),                    -- 'stop', 'target', 'trail', 'grid'
        paper        BOOLEAN DEFAULT TRUE,
        order_id     VARCHAR(100),
        timestamp    TIMESTAMPTZ DEFAULT NOW(),
        exit_time    TIMESTAMPTZ
      );
    `);
    console.log('✅ kraken_trades table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_heartbeats (
        bot        VARCHAR(50) PRIMARY KEY,
        last_seen  TIMESTAMPTZ DEFAULT NOW(),
        metadata   JSONB
      );
    `);
    console.log('✅ bot_heartbeats table ready');

    // Seed heartbeat rows so dashboard shows bots
    await client.query(`
      INSERT INTO bot_heartbeats (bot, last_seen, metadata)
      VALUES
        ('zeus',   NOW() - INTERVAL '1 hour', '{"status": "starting"}'),
        ('kronos', NOW() - INTERVAL '1 hour', '{"status": "starting"}')
      ON CONFLICT (bot) DO NOTHING;
    `);
    console.log('✅ Heartbeat seed rows inserted');

    console.log('\n✅ Migration complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
