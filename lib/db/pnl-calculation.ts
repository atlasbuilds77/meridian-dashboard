/**
 * P&L Calculation Utilities
 * 
 * These provide consistent P&L calculation across all queries.
 * ALWAYS use these instead of raw pnl column access to handle:
 * 1. Trades with null pnl (imported without calculation)
 * 2. Trades with entry/exit prices but no stored pnl
 * 
 * Source of truth is Tradier /gainloss endpoint.
 * Calculated P&L is a fallback when Tradier data isn't available.
 */

/**
 * SQL CTE (Common Table Expression) for calculating P&L
 * 
 * Use this in queries that need P&L to ensure consistent calculation.
 * 
 * Returns columns:
 * - All original trade columns
 * - calculated_pnl: P&L value (from stored pnl OR calculated from prices)
 * - calculated_pnl_percent: P&L percentage
 * 
 * Usage:
 *   const query = `${PNL_CALCULATION_CTE('trades', 'my_user_id_param')}
 *     SELECT * FROM trades_with_pnl WHERE status = 'closed'`;
 */
export function PNL_CALCULATION_CTE(tableName: string = 'trades', userIdParam: string = '$1'): string {
  return `
    WITH trades_with_pnl AS (
      SELECT
        t.*,
        COALESCE(
          t.pnl,
          CASE
            WHEN t.exit_price IS NULL THEN NULL
            WHEN t.exit_price = 0 THEN NULL
            WHEN UPPER(t.direction) IN ('LONG', 'CALL')
              THEN (t.exit_price - t.entry_price) * t.quantity * 
                   CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
            WHEN UPPER(t.direction) IN ('SHORT', 'PUT')
              THEN (t.entry_price - t.exit_price) * t.quantity * 
                   CASE WHEN t.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
            ELSE NULL
          END
        ) AS calculated_pnl,
        COALESCE(
          t.pnl_percent,
          CASE
            WHEN t.exit_price IS NULL THEN NULL
            WHEN t.exit_price = 0 THEN NULL
            WHEN t.entry_price = 0 THEN NULL
            WHEN UPPER(t.direction) IN ('LONG', 'CALL')
              THEN ((t.exit_price - t.entry_price) / t.entry_price) * 100
            WHEN UPPER(t.direction) IN ('SHORT', 'PUT')
              THEN ((t.entry_price - t.exit_price) / t.entry_price) * 100
            ELSE NULL
          END
        ) AS calculated_pnl_percent
      FROM ${tableName} t
      WHERE t.user_id = ${userIdParam}
    )`;
}

/**
 * SQL fragment for calculating P&L inline (without CTE)
 * Use when you can't use a CTE (e.g., in UPDATE statements)
 */
export const PNL_CALCULATION_INLINE = `
  COALESCE(
    pnl,
    CASE
      WHEN exit_price IS NULL THEN NULL
      WHEN exit_price = 0 THEN NULL
      WHEN UPPER(direction) IN ('LONG', 'CALL')
        THEN (exit_price - entry_price) * quantity * 
             CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
      WHEN UPPER(direction) IN ('SHORT', 'PUT')
        THEN (entry_price - exit_price) * quantity * 
             CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
      ELSE NULL
    END
  )`;

/**
 * SQL fragment for calculating P&L percentage inline
 */
export const PNL_PERCENT_CALCULATION_INLINE = `
  COALESCE(
    pnl_percent,
    CASE
      WHEN exit_price IS NULL THEN NULL
      WHEN exit_price = 0 THEN NULL
      WHEN entry_price = 0 THEN NULL
      WHEN UPPER(direction) IN ('LONG', 'CALL')
        THEN ((exit_price - entry_price) / entry_price) * 100
      WHEN UPPER(direction) IN ('SHORT', 'PUT')
        THEN ((entry_price - exit_price) / entry_price) * 100
      ELSE NULL
    END
  )`;

/**
 * JavaScript function to calculate P&L for a trade object
 * Use for in-memory calculations or validation
 */
export function calculateTradePnl(trade: {
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  direction: string;
  asset_type: string;
  pnl?: number | null;
}): { pnl: number | null; pnl_percent: number | null } {
  // If already has P&L, use it
  if (trade.pnl !== null && trade.pnl !== undefined) {
    return { 
      pnl: trade.pnl, 
      pnl_percent: trade.entry_price > 0 
        ? (trade.pnl / (trade.entry_price * trade.quantity * 
            (trade.asset_type === 'option' || trade.asset_type === 'future' ? 100 : 1))) * 100
        : null 
    };
  }

  // Can't calculate without exit price
  if (trade.exit_price === null || trade.exit_price === 0) {
    return { pnl: null, pnl_percent: null };
  }

  const multiplier = (trade.asset_type === 'option' || trade.asset_type === 'future') ? 100 : 1;
  const isLong = ['LONG', 'CALL'].includes(trade.direction.toUpperCase());
  const priceDiff = trade.exit_price - trade.entry_price;

  const pnl = isLong
    ? priceDiff * trade.quantity * multiplier
    : -priceDiff * trade.quantity * multiplier;

  const pnl_percent = trade.entry_price > 0
    ? (priceDiff / trade.entry_price) * 100 * (isLong ? 1 : -1)
    : null;

  return { pnl, pnl_percent };
}

/**
 * Validate that a trade's stored P&L matches calculated P&L
 * Returns error message if mismatch, null if OK
 */
export function validateStoredPnl(trade: {
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  direction: string;
  asset_type: string;
  pnl: number | null;
}): string | null {
  if (trade.pnl === null || trade.exit_price === null) {
    return null; // Can't validate
  }

  const calculated = calculateTradePnl({ ...trade, pnl: undefined });
  
  if (calculated.pnl === null) {
    return null;
  }

  // Allow 10% tolerance for fees/rounding
  const tolerance = Math.abs(calculated.pnl) * 0.1 + 1;
  const diff = Math.abs(trade.pnl - calculated.pnl);

  if (diff > tolerance) {
    return `P&L mismatch: stored $${trade.pnl.toFixed(2)}, calculated $${calculated.pnl.toFixed(2)} (diff: $${diff.toFixed(2)})`;
  }

  return null;
}
