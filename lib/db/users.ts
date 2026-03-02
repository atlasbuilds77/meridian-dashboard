import pool from './pool';

export interface User {
  id: number;
  discord_id: string;
  username: string;
  discriminator?: string;
  avatar?: string;
  created_at: Date;
  updated_at: Date;
  last_login: Date;
}

export interface Account {
  id: number;
  user_id: number;
  platform: string;
  account_name: string;
  account_id?: string;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Trade {
  id: number;
  user_id: number;
  account_id?: number;
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'CALL' | 'PUT';
  asset_type: 'stock' | 'option' | 'future' | 'crypto';
  strike?: number;
  expiry?: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  entry_date: Date;
  exit_date?: Date;
  pnl?: number;
  pnl_percent?: number;
  status: 'open' | 'closed' | 'stopped';
  notes?: string;
  chart_url?: string;
  created_at: Date;
  updated_at: Date;
}

// FIXED: Race condition - uses INSERT ... ON CONFLICT (atomic upsert)
export async function getOrCreateUser(discordId: string, username: string, avatar?: string): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (discord_id, username, avatar) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (discord_id) 
     DO UPDATE SET 
       last_login = CURRENT_TIMESTAMP, 
       username = EXCLUDED.username, 
       avatar = EXCLUDED.avatar,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [discordId, username, avatar || null]
  );
  
  return result.rows[0] as User;
}

export async function getUserByDiscordId(discordId: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT * FROM users WHERE discord_id = $1',
    [discordId]
  );
  
  return result.rows.length > 0 ? (result.rows[0] as User) : null;
}

export async function getUserAccounts(userId: number): Promise<Account[]> {
  const result = await pool.query(
    'SELECT * FROM accounts WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
    [userId]
  );
  
  return result.rows as Account[];
}

// FIXED: Capped limit parameter
export async function getUserTrades(userId: number, limit = 100): Promise<Trade[]> {
  const cappedLimit = Math.min(limit, 500); // Max 500 trades
  
  const result = await pool.query(
    'SELECT * FROM trades WHERE user_id = $1 ORDER BY entry_date DESC LIMIT $2',
    [userId, cappedLimit]
  );
  
  return result.rows as Trade[];
}

export async function getUserStats(userId: number) {
  const result = await pool.query(
    `WITH source_pref AS (
      SELECT EXISTS(
        SELECT 1
        FROM trades
        WHERE user_id = $1
          AND status = 'closed'
          AND tradier_position_id IS NOT NULL
      ) AS use_tradier
    ),
    filtered_closed AS (
      SELECT
        COALESCE(
          t.pnl,
          CASE
            WHEN t.exit_price IS NULL THEN NULL
            WHEN UPPER(t.direction) IN ('LONG', 'CALL')
              THEN (t.exit_price - t.entry_price) * t.quantity * CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
            WHEN UPPER(t.direction) IN ('SHORT', 'PUT')
              THEN (t.entry_price - t.exit_price) * t.quantity * CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
            ELSE NULL
          END
        ) AS pnl_value
      FROM trades t
      CROSS JOIN source_pref sp
      WHERE t.user_id = $1
        AND t.status = 'closed'
        AND (
          (sp.use_tradier AND t.tradier_position_id IS NOT NULL)
          OR (NOT sp.use_tradier AND t.tradier_position_id IS NULL)
        )
    ),
    account_stats AS (
      SELECT
        COUNT(*) AS total_accounts,
        COALESCE(SUM(balance), 0) AS total_balance
      FROM accounts
      WHERE user_id = $1
        AND is_active = true
    ),
    trade_stats AS (
      SELECT
        COUNT(*) AS total_trades,
        COUNT(*) FILTER (WHERE pnl_value > 0) AS wins,
        COUNT(*) FILTER (WHERE pnl_value < 0) AS losses,
        COALESCE(SUM(pnl_value), 0) AS total_pnl
      FROM filtered_closed
    )
    SELECT
      a.total_accounts,
      a.total_balance,
      t.total_trades,
      t.wins,
      t.losses,
      t.total_pnl,
      CASE
        WHEN t.total_trades > 0 THEN ROUND((t.wins::DECIMAL / t.total_trades::DECIMAL) * 100, 2)
        ELSE 0
      END AS win_rate
    FROM account_stats a
    CROSS JOIN trade_stats t`,
    [userId]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  return {
    total_accounts: 0,
    total_balance: 0,
    total_trades: 0,
    wins: 0,
    losses: 0,
    total_pnl: 0,
    win_rate: 0,
  };
}
