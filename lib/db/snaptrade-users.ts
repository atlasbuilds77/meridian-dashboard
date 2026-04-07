import pool from './pool';

export interface SnapTradeUserData {
  snaptrade_user_id: string | null;
  snaptrade_user_secret: string | null;
  snaptrade_selected_account: string | null;
  snaptrade_connected_at: Date | null;
}

export async function getSnapTradeData(userId: number): Promise<SnapTradeUserData | null> {
  const result = await pool.query(
    `SELECT snaptrade_user_id, snaptrade_user_secret, snaptrade_selected_account, snaptrade_connected_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows.length > 0 ? (result.rows[0] as SnapTradeUserData) : null;
}

export async function setSnapTradeRegistration(
  userId: number,
  snaptradeUserId: string,
  snaptradeUserSecret: string
): Promise<void> {
  await pool.query(
    `UPDATE users
     SET snaptrade_user_id = $2,
         snaptrade_user_secret = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, snaptradeUserId, snaptradeUserSecret]
  );
}

export async function setSnapTradeConnected(
  userId: number,
  selectedAccount?: string
): Promise<void> {
  await pool.query(
    `UPDATE users
     SET snaptrade_connected_at = CURRENT_TIMESTAMP,
         snaptrade_selected_account = COALESCE($2, snaptrade_selected_account),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, selectedAccount || null]
  );
}

export async function setSnapTradeSelectedAccount(
  userId: number,
  accountId: string
): Promise<void> {
  await pool.query(
    `UPDATE users
     SET snaptrade_selected_account = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, accountId]
  );
}

export async function clearSnapTradeData(userId: number): Promise<void> {
  await pool.query(
    `UPDATE users
     SET snaptrade_user_id = NULL,
         snaptrade_user_secret = NULL,
         snaptrade_selected_account = NULL,
         snaptrade_connected_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId]
  );
}
