import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { AccountSchema, AccountUpdateSchema } from '@/lib/validation/schemas';
import { getApiCredential } from '@/lib/db/api-credentials';
import { TradierClient } from '@/lib/api-clients/tradier';
import { requireUserId } from '@/lib/api/require-auth';
import { validateCsrfFromRequest } from '@/lib/security/csrf';

type TradierBalanceWithMargin = {
  margin?: {
    stock_buying_power?: number;
  };
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const credential = await getApiCredential(authResult.userId, 'tradier');
    if (!credential) {
      return NextResponse.json({
        accounts: [],
        totalBalance: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const accountInfo = await pool.query(
      `SELECT account_number FROM api_credentials
       WHERE user_id = $1 AND platform = 'tradier' LIMIT 1`,
      [authResult.userId]
    );

    const accountNumber = accountInfo.rows[0]?.account_number as string | undefined;
    if (!accountNumber) {
      return NextResponse.json({
        accounts: [],
        totalBalance: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const client = new TradierClient(credential.api_key);
    const balances = await client.getBalances(accountNumber);
    const marginBalances = balances as unknown as TradierBalanceWithMargin;

    const account = {
      id: accountNumber,
      platform: 'Tradier',
      account_name: `Tradier ${accountNumber}`,
      account_id: accountNumber,
      balance: balances.total_equity || 0,
      currency: 'USD',
      is_active: true,
      buying_power:
        balances.buying_power || marginBalances.margin?.stock_buying_power || 0,
      cash_available: balances.cash_available || balances.total_cash || 0,
      market_value: balances.market_value || 0,
    };

    return NextResponse.json({
      accounts: [account],
      totalBalance: balances.total_equity || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Accounts fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  try {
    const body = await request.json();
    const validation = AccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const account = validation.data;

    const result = await pool.query(
      `INSERT INTO accounts (user_id, platform, account_name, account_id, balance, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        authResult.userId,
        account.platform,
        account.account_name,
        account.account_id || null,
        account.balance,
        account.currency,
      ]
    );

    return NextResponse.json({ success: true, account: result.rows[0] });
  } catch (error) {
    console.error('Account creation error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body as { id?: number; [key: string]: unknown };

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const validation = AccountUpdateSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const validatedUpdates = validation.data;
    if (Object.keys(validatedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const ownerCheck = await pool.query('SELECT user_id FROM accounts WHERE id = $1', [id]);
    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== authResult.userId) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(validatedUpdates)) {
      // Keys are already validated by zod schema, but double-check format
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new Error(`Invalid column name: ${key}`);
      }
      // Safe to use directly since it passed zod validation + format check
      updateFields.push(`${key} = $${paramCount++}`);
      values.push(value);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const idParam = paramCount++;
    const userIdParam = paramCount++;

    const result = await pool.query(
      `UPDATE accounts SET ${updateFields.join(', ')} WHERE id = $${idParam} AND user_id = $${userIdParam} RETURNING *`,
      [...values, id, authResult.userId]
    );

    return NextResponse.json({ success: true, account: result.rows[0] });
  } catch (error) {
    console.error('Account update error:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) {
    return authResult.response;
  }

  // CSRF Protection
  const csrfResult = await validateCsrfFromRequest(request);
  if (!csrfResult.valid) {
    return csrfResult.response;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE accounts
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, authResult.userId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
