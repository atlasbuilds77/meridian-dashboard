import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured');
}

const isProduction = process.env.NODE_ENV === 'production';
const useSsl = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL !== 'false'
  : isProduction;

const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED
  ? process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
  : isProduction;

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: useSsl
    ? {
        rejectUnauthorized,
      }
    : undefined,
});

pool.on('error', (error) => {
  console.error('Database pool idle client error', {
    message: error.message,
    code: (error as NodeJS.ErrnoException).code,
  });
});

export default pool;
