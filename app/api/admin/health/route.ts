/**
 * Admin Health Check API
 * 
 * Monitors system health including:
 * - Database connectivity
 * - Tradier sync status
 * - Data quality (trades with null P&L)
 * - Last successful sync time
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HealthStatus {
  healthy: boolean;
  timestamp: string;
  checks: {
    database: { status: 'ok' | 'error'; latency_ms?: number; error?: string };
    tradierSync: { 
      status: 'ok' | 'warning' | 'error'; 
      lastSync?: string; 
      hoursSinceSync?: number;
      error?: string;
    };
    dataQuality: {
      status: 'ok' | 'warning' | 'error';
      tradesWithNullPnl: number;
      tradesWithMismatchedPnl: number;
      details?: string;
    };
  };
  summary: string;
}

export async function GET(): Promise<NextResponse> {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const health: HealthStatus = {
    healthy: true,
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok' },
      tradierSync: { status: 'ok' },
      dataQuality: { status: 'ok', tradesWithNullPnl: 0, tradesWithMismatchedPnl: 0 },
    },
    summary: 'All systems operational',
  };

  const issues: string[] = [];

  // Check 1: Database connectivity
  try {
    const startTime = Date.now();
    await pool.query('SELECT 1');
    health.checks.database.latency_ms = Date.now() - startTime;
  } catch (error: unknown) {
    health.checks.database.status = 'error';
    health.checks.database.error = error instanceof Error ? error.message : 'Unknown error';
    health.healthy = false;
    issues.push('Database connection failed');
  }

  // Check 2: Tradier sync status
  try {
    const syncResult = await pool.query(
      `SELECT success, synced_at, trades_synced, errors
       FROM sync_status
       WHERE sync_type = 'tradier_gainloss'`
    );

    if (syncResult.rows.length > 0) {
      const sync = syncResult.rows[0];
      const lastSync = sync.synced_at ? new Date(sync.synced_at) : null;
      
      if (lastSync) {
        const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
        health.checks.tradierSync.lastSync = lastSync.toISOString();
        health.checks.tradierSync.hoursSinceSync = Math.round(hoursSinceSync * 10) / 10;

        if (!sync.success) {
          health.checks.tradierSync.status = 'error';
          issues.push('Last Tradier sync failed');
        } else if (hoursSinceSync > 48) {
          health.checks.tradierSync.status = 'warning';
          issues.push(`Tradier sync is ${Math.round(hoursSinceSync)}h old`);
        }
      } else {
        health.checks.tradierSync.status = 'warning';
        health.checks.tradierSync.error = 'Never synced';
        issues.push('Tradier sync has never run');
      }
    } else {
      health.checks.tradierSync.status = 'warning';
      health.checks.tradierSync.error = 'No sync status record';
      issues.push('Tradier sync status not tracked');
    }
  } catch (error: unknown) {
    // Table might not exist yet
    health.checks.tradierSync.status = 'warning';
    health.checks.tradierSync.error = 'Sync status table not found';
  }

  // Check 3: Data quality - trades with null P&L that should have P&L
  try {
    const nullPnlResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM trades
       WHERE pnl IS NULL
         AND exit_price IS NOT NULL
         AND status = 'closed'`
    );
    
    const nullPnlCount = parseInt(nullPnlResult.rows[0].count, 10);
    health.checks.dataQuality.tradesWithNullPnl = nullPnlCount;

    if (nullPnlCount > 10) {
      health.checks.dataQuality.status = 'warning';
      health.checks.dataQuality.details = `${nullPnlCount} trades missing P&L - run sync to fix`;
      issues.push(`${nullPnlCount} trades have null P&L`);
    } else if (nullPnlCount > 0) {
      health.checks.dataQuality.details = `${nullPnlCount} trades will calculate P&L dynamically`;
    }

    // Check for P&L mismatches (stored vs calculated differ significantly)
    const mismatchResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM trades
       WHERE pnl IS NOT NULL
         AND exit_price IS NOT NULL
         AND status = 'closed'
         AND ABS(
           pnl - (
             CASE
               WHEN UPPER(direction) IN ('LONG', 'CALL')
                 THEN (exit_price - entry_price) * quantity * 
                      CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
               ELSE (entry_price - exit_price) * quantity * 
                    CASE WHEN asset_type IN ('option', 'future') THEN 100 ELSE 1 END
             END
           )
         ) > 10` // More than $10 difference
    );

    const mismatchCount = parseInt(mismatchResult.rows[0].count, 10);
    health.checks.dataQuality.tradesWithMismatchedPnl = mismatchCount;

    if (mismatchCount > 5) {
      health.checks.dataQuality.status = 'warning';
      issues.push(`${mismatchCount} trades have P&L discrepancies`);
    }
  } catch (error: unknown) {
    health.checks.dataQuality.status = 'error';
    health.checks.dataQuality.details = error instanceof Error ? error.message : 'Query failed';
  }

  // Determine overall health
  const hasError = Object.values(health.checks).some(
    (check) => check.status === 'error'
  );
  const hasWarning = Object.values(health.checks).some(
    (check) => check.status === 'warning'
  );

  if (hasError) {
    health.healthy = false;
    health.summary = `System unhealthy: ${issues.join(', ')}`;
  } else if (hasWarning) {
    health.summary = `Warnings: ${issues.join(', ')}`;
  } else {
    health.summary = 'All systems operational';
  }

  return NextResponse.json(health, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
