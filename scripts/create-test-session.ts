/**
 * create-test-session.ts
 * 
 * Creates (or finds) a test user in the DB and outputs the env vars
 * needed to run expect-cli E2E tests with auth bypass.
 *
 * Usage:
 *   npx tsx scripts/create-test-session.ts
 *
 * Requires DATABASE_URL in .env.local (or environment).
 */

import { Pool } from 'pg';
import { randomBytes } from 'crypto';

const DATABASE_URL: string = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is required. Export it or add to .env.local');
  process.exit(1);
}

const TEST_DISCORD_ID = 'test-user-000000000000';
const TEST_USERNAME = 'E2E Test User';

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
      ? undefined
      : { rejectUnauthorized: false },
  });

  try {
    // Upsert test user
    const result = await pool.query(
      `INSERT INTO users (discord_id, username, avatar)
       VALUES ($1, $2, NULL)
       ON CONFLICT (discord_id)
       DO UPDATE SET
         last_login = CURRENT_TIMESTAMP,
         username = EXCLUDED.username,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, discord_id, username`,
      [TEST_DISCORD_ID, TEST_USERNAME]
    );

    const user = result.rows[0];
    const sessionSecret = randomBytes(32).toString('hex');

    console.log('');
    console.log('=== E2E Test Session Created ===');
    console.log(`  DB User ID:    ${user.id}`);
    console.log(`  Discord ID:    ${user.discord_id}`);
    console.log(`  Username:      ${user.username}`);
    console.log('');
    console.log('Add these to your environment (or .env.test):');
    console.log('');
    console.log(`TEST_MODE=true`);
    console.log(`TEST_SESSION_SECRET=${sessionSecret}`);
    console.log(`TEST_USER_DB_ID=${user.id}`);
    console.log('');
    console.log('The expect-cli test script will inject a cookie:');
    console.log(`  TEST_SESSION_TOKEN=${sessionSecret}`);
    console.log('');
    console.log('=================================');
  } catch (err) {
    console.error('Failed to create test user:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
