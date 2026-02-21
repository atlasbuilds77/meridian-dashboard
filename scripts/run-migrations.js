// Run database migrations
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
    const migrationPath = path.join(__dirname, '../lib/db/schema-onboarding.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running onboarding schema migration...');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
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
