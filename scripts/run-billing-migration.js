// Run billing database migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://meridian_user:8uOhIfyylf2gExR4yU8z7L9bg1z2kbC3@dpg-d6cfdna4d50c7383a61g-a.oregon-postgres.render.com/meridian_0j0f';

async function runMigrations() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to database...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../lib/db/schema-billing.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running billing schema migration...');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Billing migration completed successfully!');
    console.log('\nTables created:');
    console.log('  - billing_periods');
    console.log('  - payments');
    console.log('  - user_payment_methods');
    console.log('  - billing_events');
    console.log('\nFunctions created:');
    console.log('  - get_default_payment_method()');
    console.log('  - calculate_weekly_pnl()');
    console.log('  - get_unpaid_periods()');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error(err);
  process.exit(1);
});
