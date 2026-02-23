#!/usr/bin/env node
/**
 * Database Verification Script
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('📊 Checking database tables...\n');

    // List all tables
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('Tables created:');
    tables.forEach(({ table_name }) => {
      console.log(`  ✅ ${table_name}`);
    });

    console.log('\n📋 Table row counts:');
    for (const { table_name } of tables) {
      // Validate table name format (alphanumeric + underscore only)
      if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
        console.log(`  ${table_name}: SKIPPED (invalid name)`);
        continue;
      }
      
      // Safe to use in query since it came from information_schema and passed validation
      const { rows } = await pool.query(`SELECT COUNT(*) FROM "${table_name}"`);
      console.log(`  ${table_name}: ${rows[0].count} rows`);
    }

    console.log('\n✅ Database ready!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
