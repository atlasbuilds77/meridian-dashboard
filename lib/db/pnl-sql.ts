/**
 * Shared SQL builders for P&L calculations.
 *
 * Net P&L priority:
 * 1) Stored `pnl` from database (source of truth when present)
 * 2) Fallback to `gross_pnl - commission`
 * 3) If commission is unavailable, assume 0 for fallback rows
 */

function normalizeAlias(alias: string): string {
  const trimmed = alias.trim();
  return trimmed.length > 0 ? trimmed : 't';
}

export function buildGrossPnlSql(alias = 't'): string {
  const a = normalizeAlias(alias);
  return `
    CASE
      WHEN ${a}.exit_price IS NULL THEN NULL
      WHEN ${a}.exit_price = 0 THEN NULL
      WHEN UPPER(${a}.direction) IN ('LONG', 'CALL')
        THEN (${a}.exit_price - ${a}.entry_price) * ${a}.quantity *
             CASE WHEN ${a}.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
      WHEN UPPER(${a}.direction) IN ('SHORT', 'PUT')
        THEN (${a}.entry_price - ${a}.exit_price) * ${a}.quantity *
             CASE WHEN ${a}.asset_type IN ('option', 'future') THEN 100 ELSE 1 END
      ELSE NULL
    END
  `;
}

export function buildCommissionSql(alias = 't'): string {
  const a = normalizeAlias(alias);
  const rowJson = `to_jsonb(${a})`;
  return `
    COALESCE(
      CASE
        WHEN (${rowJson} ->> 'commission') ~ '^-?\\d+(\\.\\d+)?$'
          THEN (${rowJson} ->> 'commission')::numeric
        WHEN (${rowJson} ->> 'commissions') ~ '^-?\\d+(\\.\\d+)?$'
          THEN (${rowJson} ->> 'commissions')::numeric
        WHEN (${rowJson} ->> 'fee') ~ '^-?\\d+(\\.\\d+)?$'
          THEN (${rowJson} ->> 'fee')::numeric
        WHEN (${rowJson} ->> 'fees') ~ '^-?\\d+(\\.\\d+)?$'
          THEN (${rowJson} ->> 'fees')::numeric
        ELSE 0
      END,
      0
    )
  `;
}

export function buildNetPnlSql(alias = 't'): string {
  const a = normalizeAlias(alias);
  const grossSql = buildGrossPnlSql(a);
  const commissionSql = buildCommissionSql(a);
  return `
    COALESCE(
      ${a}.pnl,
      CASE
        WHEN (${grossSql}) IS NULL THEN NULL
        ELSE (${grossSql}) - (${commissionSql})
      END
    )
  `;
}
