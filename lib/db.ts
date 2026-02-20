import { Pool } from 'pg';

// Helios PostgreSQL connection
const pool = new Pool({
  connectionString: 'postgresql://postgresql_e5fi_user:moo24YFbny662K6sJvhpJLTAI6DSVlR5@dpg-d48i5r2li9vc739av9cg-a.oregon-postgres.render.com/postgresql_e5fi',
  ssl: {
    rejectUnauthorized: false
  }
});

export async function queryHelios(query: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export { pool };
