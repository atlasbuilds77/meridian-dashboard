#!/usr/bin/env node
/**
 * Database Verification Script
 */

const { Pool } = require('pg');
const format = require('pg-format');
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
      // Use pg-format to safely escape table identifier
      const query = format('SELECT COUNT(*) FROM %I', table_name);
      const { rows } = await pool.query(query);
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
