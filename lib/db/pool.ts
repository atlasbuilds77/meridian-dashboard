import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured');
}

const isProduction = process.env.NODE_ENV === 'production';
function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value !== 'false';
}

function shouldUseSslByDefault(databaseUrl: string): boolean {
  try {
    const { hostname } = new URL(databaseUrl);
    return hostname !== 'localhost' && hostname !== '127.0.0.1';
  } catch {
    return isProduction;
  }
}

const configuredUseSsl = parseBool(process.env.DATABASE_SSL);
const useSsl = configuredUseSsl ?? shouldUseSslByDefault(DATABASE_URL);

const configuredRejectUnauthorized = parseBool(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED);
const rejectUnauthorized = configuredRejectUnauthorized ?? isProduction;

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
