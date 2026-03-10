#!/usr/bin/env node
/**
 * Run NDA table migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('📊 Running NDA table migration...\n');

    const sql = fs.readFileSync(path.join(__dirname, 'add-nda-table-pg.sql'), 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ NDA table created successfully\n');

    // Verify table exists
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'nda_acceptances'
      ORDER BY ordinal_position;
    `);

    console.log('Table structure:');
    rows.forEach(({ column_name, data_type }) => {
      console.log(`  ${column_name}: ${data_type}`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
