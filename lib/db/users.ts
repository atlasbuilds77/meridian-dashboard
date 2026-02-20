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
    'SELECT * FROM user_portfolio_summary WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return {
      total_accounts: 0,
      total_balance: 0,
      total_trades: 0,
      wins: 0,
      losses: 0,
      total_pnl: 0,
      win_rate: 0
    };
  }
  
  return result.rows[0];
}
