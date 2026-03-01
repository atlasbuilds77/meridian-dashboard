#!/usr/bin/env node
/**
 * Run Trade Sync Migration
 * Applies the tradier_trade_id column migration
 * 
 * Usage:
 *   node scripts/run-trade-sync-migration.js
 * 
 * Or run the SQL directly in Supabase Dashboard > SQL Editor
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  console.error('');
  console.error('Set it via:');
  console.error('  export DATABASE_URL="postgresql://..."');
  console.error('');
  console.error('Or run the migration SQL directly in Supabase Dashboard:');
  console.error('  1. Go to https://supabase.com/dashboard');
  console.error('  2. Select your project');
  console.error('  3. Go to SQL Editor');
  console.error('  4. Paste contents of lib/db/migrations/20260301_add_tradier_trade_id.sql');
  console.error('  5. Click "Run"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🔄 Running trade sync migration...\n');

  const migrationPath = path.join(__dirname, '../lib/db/migrations/20260301_add_tradier_trade_id.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration SQL:');
  console.log('─'.repeat(50));
  console.log(sql);
  console.log('─'.repeat(50));
  console.log('');

  const client = await pool.connect();
  
  try {
    // Split by semicolons and execute each statement
    // Filter out comments and empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`⏳ Executing: ${statement.substring(0, 60)}...`);
      await client.query(statement);
      console.log('   ✅ Done');
    }

    console.log('\n✅ Migration completed successfully!');
    
    // Verify the column was added
    const verifyResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'trades' AND column_name = 'tradier_trade_id'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n📊 Verified: tradier_trade_id column exists');
      console.log(`   Type: ${verifyResult.rows[0].data_type}`);
    } else {
      console.warn('\n⚠️  Warning: Could not verify column was created');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code === '42701') {
      console.log('   (Column already exists - this is OK)');
    } else {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
