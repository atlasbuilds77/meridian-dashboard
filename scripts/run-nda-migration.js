const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS nda_acceptances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        accepted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_nda_user_id ON nda_acceptances(user_id);
    `);
    
    console.log('✅ NDA migration complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
