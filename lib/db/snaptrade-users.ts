import pool from './pool';

export type TradingSystem = 'helios' | 'meridian';

export interface SnapTradeUserData {
  snaptrade_user_id: string | null;
  snaptrade_user_secret: string | null;
  snaptrade_selected_account: string | null;
  snaptrade_connected_at: Date | null;
  helios_snaptrade_account: string | null;
  meridian_snaptrade_account: string | null;
  helios_auto_execute_enabled: boolean;
  meridian_auto_execute_enabled: boolean;
}

export async function getSnapTradeData(userId: number): Promise<SnapTradeUserData | null> {
  const result = await pool.query(
    `SELECT snaptrade_user_id, snaptrade_user_secret, snaptrade_selected_account, snaptrade_connected_at,
            helios_snaptrade_account, meridian_snaptrade_account,
            COALESCE(helios_auto_execute_enabled, false) as helios_auto_execute_enabled,
            COALESCE(meridian_auto_execute_enabled, false) as meridian_auto_execute_enabled
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

// --- Per-system account getters/setters ---

export async function getHeliosAccount(userId: number): Promise<string | null> {
  const result = await pool.query(
    `SELECT helios_snaptrade_account FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.helios_snaptrade_account || null;
}

export async function getMeridianAccount(userId: number): Promise<string | null> {
  const result = await pool.query(
    `SELECT meridian_snaptrade_account FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.meridian_snaptrade_account || null;
}

export async function setHeliosAccount(userId: number, accountId: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET helios_snaptrade_account = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, accountId]
  );
}

export async function setMeridianAccount(userId: number, accountId: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET meridian_snaptrade_account = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, accountId]
  );
}

export async function setSystemAccount(
  userId: number,
  system: TradingSystem,
  accountId: string
): Promise<void> {
  if (system === 'helios') {
    await setHeliosAccount(userId, accountId);
  } else {
    await setMeridianAccount(userId, accountId);
  }
}

export async function getSystemAccount(
  userId: number,
  system: TradingSystem
): Promise<string | null> {
  if (system === 'helios') {
    return getHeliosAccount(userId);
  } else {
    return getMeridianAccount(userId);
  }
}

// --- Per-system auto-execute getters/setters ---

export async function getAutoExecuteStatus(userId: number): Promise<{
  helios: boolean;
  meridian: boolean;
}> {
  const result = await pool.query(
    `SELECT COALESCE(helios_auto_execute_enabled, false) as helios,
            COALESCE(meridian_auto_execute_enabled, false) as meridian
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || { helios: false, meridian: false };
}

export async function setAutoExecuteForSystem(
  userId: number,
  system: TradingSystem,
  enabled: boolean
): Promise<void> {
  const col = system === 'helios' ? 'helios_auto_execute_enabled' : 'meridian_auto_execute_enabled';
  await pool.query(
    `UPDATE users SET ${col} = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [userId, enabled]
  );
}

export async function clearSnapTradeData(userId: number): Promise<void> {
  await pool.query(
    `UPDATE users
     SET snaptrade_user_id = NULL,
         snaptrade_user_secret = NULL,
         snaptrade_selected_account = NULL,
         snaptrade_connected_at = NULL,
         helios_snaptrade_account = NULL,
         meridian_snaptrade_account = NULL,
         helios_auto_execute_enabled = false,
         meridian_auto_execute_enabled = false,
         auto_execute_enabled = false,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId]
  );
}
