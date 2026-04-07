import { Pool } from 'pg';

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;

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

  _pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased from 5s to 10s for Render
    ssl: useSsl
      ? {
          rejectUnauthorized,
        }
      : undefined,
    // TCP Keepalive settings for Render PostgreSQL stability
    keepAlive: true,
    keepAliveInitialDelayMillis: 30000,
  });

  _pool.on('error', (error) => {
    console.error('Database pool idle client error', {
      message: error.message,
      code: (error as NodeJS.ErrnoException).code,
    });
  });

  // Graceful connection recovery
  _pool.on('connect', (client) => {
    client.on('error', (err) => {
      console.error('Database client error:', err.message);
    });
  });

  return _pool;
}

// Proxy object that lazily initializes the pool on first use
const pool = new Proxy({} as Pool, {
  get(_target, prop: string | symbol) {
    const realPool = getPool();
    const value = (realPool as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(realPool);
    }
    return value;
  },
});

export default pool;
