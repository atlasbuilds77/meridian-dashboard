import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { decryptApiKey } from '@/lib/crypto/encryption';
import { TradierClient, TradierBalance, TradierPosition } from '@/lib/api-clients/tradier';

export const dynamic = 'force-dynamic';

interface UserAccountValue {
  userId: number;
  username: string;
  discordId: string;
  avatar: string | null;
  accountNumber: string | null;
  // Account values
  totalEquity: number | null;
  cashBalance: number | null;
  positionsValue: number | null;
  buyingPower: number | null;
  // Status
  status: 'success' | 'no_credentials' | 'error';
  error?: string;
  // Positions detail
  positions?: Array<{
    symbol: string;
    quantity: number;
    costBasis: number;
    currentValue?: number;
  }>;
}

/**
 * Decrypt API credentials for a user
 */
async function decryptUserCredentials(row: {
  encrypted_api_key: string;
  encryption_iv: string;
  encrypted_api_secret?: string | null;
}): Promise<{ apiKey: string; apiSecret?: string } | null> {
  try {
    // Parse encrypted key and auth tag
    const [encryptedKey, authTag] = row.encrypted_api_key.split(':');
    if (!authTag) {
      console.error('Missing auth tag in encrypted_api_key');
      return null;
    }

    const apiKey = decryptApiKey(encryptedKey, row.encryption_iv, authTag);

    let apiSecret: string | undefined;
    if (row.encrypted_api_secret) {
      const parts = row.encrypted_api_secret.split(':');
      if (parts.length === 3) {
        const [secretIvPart, encryptedSecretPart, secretAuthTag] = parts;
        apiSecret = decryptApiKey(encryptedSecretPart, secretIvPart, secretAuthTag);
      } else if (parts.length === 2) {
        const [encryptedSecretPart, secretAuthTag] = parts;
        apiSecret = decryptApiKey(encryptedSecretPart, row.encryption_iv, secretAuthTag);
      }
    }

    return { apiKey, apiSecret };
  } catch (error) {
    console.error('Failed to decrypt credentials:', error);
    return null;
  }
}

/**
 * GET /api/admin/account-values
 * Fetches live Tradier account values for all users with connected accounts
 */
export async function GET(req: NextRequest) {
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const limiterResult = await enforceRateLimit({
    request: req,
    name: 'admin_account_values',
    limit: 10, // Lower limit since this makes external API calls
    windowMs: 60_000,
    userId: adminResult.session.dbUserId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'admin_account_values');
  }

  try {
    // Get all users with Tradier credentials
    const { rows } = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.discord_id,
        u.avatar,
        ac.account_number,
        ac.encrypted_api_key,
        ac.encryption_iv,
        ac.encrypted_api_secret,
        ac.verification_status
      FROM users u
      LEFT JOIN api_credentials ac ON ac.user_id = u.id AND ac.platform = 'tradier'
      ORDER BY u.username ASC
    `);

    const accountValues: UserAccountValue[] = [];

    // Process each user
    for (const row of rows) {
      const baseInfo = {
        userId: row.user_id,
        username: row.username,
        discordId: row.discord_id,
        avatar: row.avatar,
        accountNumber: row.account_number,
      };

      // No Tradier credentials
      if (!row.encrypted_api_key || !row.account_number) {
        accountValues.push({
          ...baseInfo,
          totalEquity: null,
          cashBalance: null,
          positionsValue: null,
          buyingPower: null,
          status: 'no_credentials',
        });
        continue;
      }

      // Decrypt credentials
      const credentials = await decryptUserCredentials(row);
      if (!credentials) {
        accountValues.push({
          ...baseInfo,
          totalEquity: null,
          cashBalance: null,
          positionsValue: null,
          buyingPower: null,
          status: 'error',
          error: 'Failed to decrypt credentials',
        });
        continue;
      }

      // Fetch from Tradier API
      try {
        const client = new TradierClient(credentials.apiKey);
        const [balances, positions] = await Promise.all([
          client.getBalances(row.account_number),
          client.getPositions(row.account_number),
        ]);

        accountValues.push({
          ...baseInfo,
          totalEquity: balances.total_equity || 0,
          cashBalance: balances.total_cash || 0,
          positionsValue: balances.market_value || 0,
          buyingPower: balances.buying_power || 0,
          status: 'success',
          positions: positions.map((p) => ({
            symbol: p.symbol,
            quantity: p.quantity,
            costBasis: p.cost_basis,
          })),
        });
      } catch (apiError: unknown) {
        const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
        console.error(`Tradier API error for user ${row.user_id}:`, errorMessage);
        
        accountValues.push({
          ...baseInfo,
          totalEquity: null,
          cashBalance: null,
          positionsValue: null,
          buyingPower: null,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    // Calculate totals
    const successfulAccounts = accountValues.filter((a) => a.status === 'success');
    const totals = {
      totalEquity: successfulAccounts.reduce((sum, a) => sum + (a.totalEquity || 0), 0),
      totalCash: successfulAccounts.reduce((sum, a) => sum + (a.cashBalance || 0), 0),
      totalPositionsValue: successfulAccounts.reduce((sum, a) => sum + (a.positionsValue || 0), 0),
      accountCount: successfulAccounts.length,
    };

    return NextResponse.json({
      accounts: accountValues,
      totals,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Admin account values fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
