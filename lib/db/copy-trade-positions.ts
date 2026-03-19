import pool from './pool';

export interface CopyTradePosition {
  id: number;
  user_id: number;
  bot: 'oracle' | 'nightwatch';
  market_id: string | null;
  token_id: string | null;
  asset: string | null;
  question: string | null;
  market_type: string | null;
  direction: string;
  side: string;
  shares: number;
  entry_price: number;
  current_price: number | null;
  stake_usd: number;
  pnl: number;
  pnl_percent: number;
  order_id: string | null;
  execution_status: string;
  error_message: string | null;
  dry_run: boolean;
  source_trade_id: string | null;
  outcome: string | null;
  payout: number | null;
  resolved_at: Date | null;
  status: string;
  opened_at: Date;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePositionInput {
  userId: number;
  bot: 'oracle' | 'nightwatch';
  marketId?: string;
  tokenId?: string;
  asset?: string;
  question?: string;
  marketType?: string;
  direction: string;
  side: string;
  shares: number;
  entryPrice: number;
  stakeUsd: number;
  orderId?: string;
  executionStatus?: string;
  errorMessage?: string;
  dryRun?: boolean;
  sourceTradeId?: string;
}

/**
 * Create a new copy-trade position for a user
 */
export async function createPosition(input: CreatePositionInput): Promise<CopyTradePosition> {
  const result = await pool.query(
    `INSERT INTO copy_trade_positions (
      user_id, bot, market_id, token_id, asset, question, market_type,
      direction, side, shares, entry_price, stake_usd,
      order_id, execution_status, error_message, dry_run, source_trade_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      input.userId,
      input.bot,
      input.marketId || null,
      input.tokenId || null,
      input.asset || null,
      input.question || null,
      input.marketType || null,
      input.direction,
      input.side,
      input.shares,
      input.entryPrice,
      input.stakeUsd,
      input.orderId || null,
      input.executionStatus || 'pending',
      input.errorMessage || null,
      input.dryRun ?? false,
      input.sourceTradeId || null,
    ]
  );
  return result.rows[0] as CopyTradePosition;
}

/**
 * Get all positions for a user (open + recent closed)
 */
export async function getUserPositions(
  userId: number,
  options: { status?: 'open' | 'closed' | 'all'; limit?: number } = {}
): Promise<CopyTradePosition[]> {
  const { status = 'all', limit = 50 } = options;

  let query = `SELECT * FROM copy_trade_positions WHERE user_id = $1`;
  const params: (number | string)[] = [userId];

  if (status !== 'all') {
    query += ` AND status = $2`;
    params.push(status);
  }

  query += ` ORDER BY opened_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows as CopyTradePosition[];
}

/**
 * Get user's P&L summary
 */
export async function getUserPnLSummary(userId: number): Promise<{
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalPnL: number;
  openPnL: number;
  realizedPnL: number;
  totalStaked: number;
  wins: number;
  losses: number;
  winRate: number;
}> {
  const result = await pool.query(
    `SELECT
      COUNT(*) as total_positions,
      COUNT(CASE WHEN status = 'open' THEN 1 END) as open_positions,
      COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_positions,
      COALESCE(SUM(pnl), 0) as total_pnl,
      COALESCE(SUM(CASE WHEN status = 'open' THEN pnl ELSE 0 END), 0) as open_pnl,
      COALESCE(SUM(CASE WHEN status = 'closed' THEN pnl ELSE 0 END), 0) as realized_pnl,
      COALESCE(SUM(stake_usd), 0) as total_staked,
      COUNT(CASE WHEN outcome = 'win' THEN 1 END) as wins,
      COUNT(CASE WHEN outcome = 'loss' THEN 1 END) as losses
    FROM copy_trade_positions
    WHERE user_id = $1 AND execution_status != 'failed'`,
    [userId]
  );

  const row = result.rows[0];
  const closed = parseInt(row.closed_positions) || 0;
  const wins = parseInt(row.wins) || 0;

  return {
    totalPositions: parseInt(row.total_positions) || 0,
    openPositions: parseInt(row.open_positions) || 0,
    closedPositions: closed,
    totalPnL: parseFloat(row.total_pnl) || 0,
    openPnL: parseFloat(row.open_pnl) || 0,
    realizedPnL: parseFloat(row.realized_pnl) || 0,
    totalStaked: parseFloat(row.total_staked) || 0,
    wins,
    losses: parseInt(row.losses) || 0,
    winRate: closed > 0 ? wins / closed : 0,
  };
}

/**
 * Update position price and P&L
 */
export async function updatePositionPrice(
  positionId: number,
  currentPrice: number
): Promise<void> {
  await pool.query(
    `UPDATE copy_trade_positions
     SET current_price = $2,
         pnl = (shares * ($2 - entry_price)),
         pnl_percent = CASE WHEN entry_price > 0 THEN (($2 - entry_price) / entry_price) ELSE 0 END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [positionId, currentPrice]
  );
}

/**
 * Update execution status
 */
export async function updateExecutionStatus(
  positionId: number,
  status: string,
  orderId?: string,
  errorMessage?: string
): Promise<void> {
  await pool.query(
    `UPDATE copy_trade_positions
     SET execution_status = $2,
         order_id = COALESCE($3, order_id),
         error_message = $4,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [positionId, status, orderId || null, errorMessage || null]
  );
}

/**
 * Close a position
 */
export async function closePosition(
  positionId: number,
  outcome: 'win' | 'loss',
  payout: number,
  finalPrice: number
): Promise<void> {
  await pool.query(
    `UPDATE copy_trade_positions
     SET status = 'closed',
         outcome = $2,
         payout = $3,
         current_price = $4,
         pnl = $3 - stake_usd,
         resolved_at = CURRENT_TIMESTAMP,
         closed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [positionId, outcome, payout, finalPrice]
  );
}

/**
 * Get all users with connected Polymarket wallets
 */
export async function getUsersWithPolymarketWallets(): Promise<Array<{
  userId: number;
  discordId: string;
  username: string;
  walletAddress: string;
}>> {
  const result = await pool.query(
    `SELECT u.id as user_id, u.discord_id, u.username, ac.key_name as wallet_address
     FROM users u
     INNER JOIN api_credentials ac ON u.id = ac.user_id
     WHERE ac.platform = 'polymarket'
       AND ac.is_active = true
       AND ac.verification_status = 'verified'
     ORDER BY u.id`
  );
  return result.rows.map((r: Record<string, unknown>) => ({
    userId: r.user_id as number,
    discordId: r.discord_id as string,
    username: r.username as string,
    walletAddress: r.wallet_address as string,
  }));
}

/**
 * Log copy-trade execution event
 */
export async function logExecution(
  userId: number,
  positionId: number | null,
  bot: string,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO copy_trade_execution_log (user_id, position_id, bot, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, positionId, bot, action, JSON.stringify(details)]
  );
}
