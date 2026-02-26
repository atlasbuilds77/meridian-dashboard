import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db/pool';
import { requireAdminSession } from '@/lib/api/require-auth';
import { getApiCredential } from '@/lib/db/api-credentials';
import { TradierClient } from '@/lib/api-clients/tradier';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { validateCsrfFromRequest } from '@/lib/security/csrf';

const paramsSchema = z.object({
  userId: z.string().regex(/^\d+$/, 'User ID must be a number'),
});

interface FlattenResult {
  success: boolean;
  message: string;
  positionsClosedViaApi: number;
  tradesMarkedClosed: number;
  totalPositions: number;
  errors?: string[];
  timestamp: string;
  adminDiscordId: string;
}

/**
 * Extract account number from Tradier profile
 * Handles both single account (object) and multiple accounts (array)
 */
function extractAccountNumber(profile: any): string | null {
  if (!profile?.profile?.account) {
    return null;
  }
  
  const account = profile.profile.account;
  
  // Multiple accounts (array) - use first active account
  if (Array.isArray(account)) {
    const activeAccount = account.find((a: any) => a.status === 'active');
    return activeAccount?.account_number || account[0]?.account_number || null;
  }

  // Single account (object)
  return account.account_number || null;
}

/**
 * Emergency Tradier client with order placement capabilities for emergency flattening
 * Uses composition with the existing TradierClient
 */
class EmergencyTradierClient {
  private tradierClient: TradierClient;
  private apiKey: string;
  private useSandbox: boolean;
  
  constructor(apiKey: string, useSandbox = false) {
    this.apiKey = apiKey;
    this.useSandbox = useSandbox;
    this.tradierClient = new TradierClient(apiKey, useSandbox);
  }
  
  private getBaseUrl(): string {
    return this.useSandbox ? 'https://sandbox.tradier.com/v1' : 'https://api.tradier.com/v1';
  }
  
  /**
   * Close a position by symbol
   * @param accountNumber Tradier account number
   * @param symbol Stock/option symbol
   * @param quantity Quantity to close (negative for short, positive for long)
   * @returns Order confirmation
   */
  async closePosition(
    accountNumber: string,
    symbol: string,
    quantity: number
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      // Determine order type based on quantity
      // Positive quantity = long position = sell to close
      // Negative quantity = short position = buy to cover
      const side = quantity > 0 ? 'sell' : 'buy';
      const absQuantity = Math.abs(quantity);
      
      const url = `${this.getBaseUrl()}/accounts/${accountNumber}/orders`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          class: 'equity',
          symbol,
          side,
          quantity: absQuantity.toString(),
          type: 'market',
          duration: 'day',
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Tradier API error (${response.status}): ${errorText}`,
        };
      }
      
      const data = await response.json();
      
      if (data.errors?.errors) {
        return {
          success: false,
          error: `Tradier order error: ${JSON.stringify(data.errors.errors)}`,
        };
      }
      
      return {
        success: true,
        orderId: data.order?.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to close position: ${error.message}`,
      };
    }
  }
  
  /**
   * Close all positions in an account
   * @param accountNumber Tradier account number
   * @returns Summary of closed positions
   */
  async closeAllPositions(accountNumber: string): Promise<{
    success: boolean;
    closed: number;
    errors: string[];
    results: Array<{ symbol: string; quantity: number; success: boolean; error?: string }>;
  }> {
    try {
      // Get current positions using the tradier client
      const positions = await this.tradierClient.getPositions(accountNumber);
      
      if (positions.length === 0) {
        return {
          success: true,
          closed: 0,
          errors: [],
          results: [],
        };
      }
      
      const results = [];
      const errors = [];
      let closed = 0;
      
      // Close each position
      for (const position of positions) {
        const result = await this.closePosition(
          accountNumber,
          position.symbol,
          position.quantity
        );
        
        results.push({
          symbol: position.symbol,
          quantity: position.quantity,
          success: result.success,
          error: result.error,
        });
        
        if (result.success) {
          closed++;
        } else {
          errors.push(`${position.symbol}: ${result.error}`);
        }
        
        // Small delay between orders to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return {
        success: errors.length === 0,
        closed,
        errors,
        results,
      };
    } catch (error: any) {
      return {
        success: false,
        closed: 0,
        errors: [`Failed to fetch positions: ${error.message}`],
        results: [],
      };
    }
  }
  
  /**
   * Get user profile (delegates to tradier client)
   */
  async getProfile(): Promise<any> {
    return this.tradierClient.getProfile();
  }
}

/**
 * Log admin action to audit log
 */
async function logAdminAction(
  adminUserId: number,
  targetUserId: number,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO api_key_audit_log (user_id, action, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [adminUserId, `admin_${action}`, JSON.stringify({
        target_user_id: targetUserId,
        ...details,
      })]
    );
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

/**
 * Mark all open trades as closed in database
 */
async function markTradesClosed(userId: number): Promise<{
  success: boolean;
  tradesClosed: number;
  error?: string;
}> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current market prices for open trades (simplified - in reality would need real-time data)
    // For now, we'll mark them as closed without exit price
    const result = await client.query(
      `UPDATE trades 
       SET status = 'closed', 
           exit_date = NOW(),
           updated_at = NOW()
       WHERE user_id = $1 AND status = 'open'
       RETURNING id, symbol, quantity, entry_price`,
      [userId]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      tradesClosed: result.rowCount || 0,
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    return {
      success: false,
      tradesClosed: 0,
      error: `Database error: ${error.message}`,
    };
  } finally {
    client.release();
  }
}

/**
 * Get user's open positions count
 */
async function getOpenPositionsCount(userId: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM trades 
     WHERE user_id = $1 AND status = 'open'`,
    [userId]
  );
  
  return parseInt(result.rows[0]?.count || '0', 10);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Parse and validate params
  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Invalid user ID parameter' },
      { status: 400 }
    );
  }
  
  const userId = parseInt(parsedParams.data.userId, 10);
  
  // Admin authentication
  const adminResult = await requireAdminSession();
  if (!adminResult.ok) {
    return adminResult.response;
  }
  
  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(req);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }
  
  const adminSession = adminResult.session;
  
  // Rate limiting
  const limiterResult = await enforceRateLimit({
    request: req,
    name: 'admin_flatten',
    limit: 5, // Very restrictive - emergency action
    windowMs: 60_000,
    userId: adminSession.dbUserId,
  });
  
  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'admin_flatten');
  }
  
  try {
    // Check if user exists
    const userCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const result: FlattenResult = {
      success: false,
      message: '',
      positionsClosedViaApi: 0,
      tradesMarkedClosed: 0,
      totalPositions: 0,
      timestamp: new Date().toISOString(),
      adminDiscordId: adminSession.discordId,
    };
    
    // Get open positions count
    result.totalPositions = await getOpenPositionsCount(userId);
    
    if (result.totalPositions === 0) {
      result.success = true;
      result.message = 'No open positions found for this user';
      
      // Log the action
      await logAdminAction(adminSession.dbUserId, userId, 'flatten', {
        action: 'attempted',
        result: 'no_open_positions',
        ...result,
      });
      
      return NextResponse.json(result);
    }
    
    // Try to get Tradier credentials
    const credential = await getApiCredential(userId, 'tradier');
    let apiFlattenResult = null;
    
    if (credential && credential.api_key) {
      // Try both production and sandbox environments
      const environments = [
        { name: 'production', useSandbox: false },
        { name: 'sandbox', useSandbox: true },
      ];
      
      let apiFlattenAttempts = [];
      
      for (const env of environments) {
        try {
          // Use emergency client to close positions via API
          const client = new EmergencyTradierClient(credential.api_key, env.useSandbox);
          
          // Try to get account number from credential or detect it
          let accountNumber = (credential as any).account_number;
          
          if (!accountNumber) {
            // Try to detect account number
            try {
              const profile = await client.getProfile();
              accountNumber = extractAccountNumber(profile);
            } catch (profileError) {
              console.warn(`Could not detect account number in ${env.name}:`, profileError);
              continue; // Try next environment
            }
          }
          
          if (!accountNumber) {
            continue; // No account number, try next environment
          }
          
          apiFlattenResult = await client.closeAllPositions(accountNumber);
          apiFlattenAttempts.push({
            environment: env.name,
            result: apiFlattenResult,
            accountNumber,
          });
          
          result.positionsClosedViaApi = apiFlattenResult.closed;
          
          if (apiFlattenResult.errors.length > 0) {
            result.errors = result.errors || [];
            result.errors.push(...apiFlattenResult.errors.map(e => `[${env.name}] ${e}`));
          }
          
          // If we successfully closed at least one position, break
          if (apiFlattenResult.closed > 0) {
            break;
          }
          
        } catch (apiError: any) {
          console.error(`Tradier API flatten error (${env.name}):`, apiError);
          result.errors = result.errors || [];
          result.errors.push(`[${env.name}] Tradier API error: ${apiError.message}`);
        }
      }
      
      if (apiFlattenAttempts.length === 0) {
        result.message = 'Tradier credentials found but could not connect to any environment, marking trades as closed in database only';
      }
    } else {
      result.message = 'No Tradier credentials found, marking trades as closed in database only';
    }
    
    // Always mark trades as closed in database (even if API failed)
    const dbResult = await markTradesClosed(userId);
    
    if (dbResult.success) {
      result.tradesMarkedClosed = dbResult.tradesClosed;
      result.success = true;
      
      if (!result.message) {
        result.message = `Successfully flattened positions. `;
        if (result.positionsClosedViaApi > 0) {
          result.message += `Closed ${result.positionsClosedViaApi} positions via Tradier API. `;
        }
        result.message += `Marked ${result.tradesMarkedClosed} trades as closed in database.`;
      }
    } else {
      result.success = false;
      result.message = `Failed to mark trades as closed: ${dbResult.error}`;
      result.errors = result.errors || [];
      result.errors.push(`Database error: ${dbResult.error}`);
    }
    
    // Log the action
    await logAdminAction(adminSession.dbUserId, userId, 'flatten', {
      action: 'executed',
      api_result: apiFlattenResult,
      db_result: dbResult,
      ...result,
    });
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
    
  } catch (error: any) {
    console.error('Emergency flatten error:', error);
    
    // Log the failure
    if (adminResult.ok) {
      await logAdminAction(adminResult.session.dbUserId, userId, 'flatten', {
        action: 'failed',
        error: error.message,
        stack: error.stack,
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error during flatten operation',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}