#!/usr/bin/env node
/**
 * Database Migration Script
 * Runs all SQL migrations in order
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration(filePath, description) {
  console.log(`\n📦 Running: ${description}`);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  try {
    await pool.query(sql);
    console.log(`✅ Success: ${description}`);
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    console.error(error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting database migrations...\n');
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1]}`);

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Run migrations in order
    await runMigration(
      path.join(__dirname, 'lib/db/schema.sql'),
      'Base Schema (users, accounts, trades)'
    );

    await runMigration(
      path.join(__dirname, 'lib/db/schema-api-keys.sql'),
      'API Keys Schema (credentials, audit log, onboarding)'
    );

    await runMigration(
      path.join(__dirname, 'lib/db/migrations/add_constraints.sql'),
      'Data Integrity Constraints'
    );

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
