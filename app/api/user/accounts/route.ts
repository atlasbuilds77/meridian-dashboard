import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';
import { AccountSchema, AccountUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

// GET - List user's accounts
export async function GET() {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const result = await pool.query(
      `SELECT * FROM accounts 
       WHERE user_id = $1 AND is_active = true 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(balance), 0) as total_balance 
       FROM accounts 
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    return NextResponse.json({
      accounts: result.rows,
      totalBalance: parseFloat(totalResult.rows[0].total_balance),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Accounts fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

// POST - Add new account
export async function POST(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    
    // FIXED: Zod validation
    const validation = AccountSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }
    
    const account = validation.data;
    
    const result = await pool.query(
      `INSERT INTO accounts (user_id, platform, account_name, account_id, balance, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, account.platform, account.account_name, account.account_id || null, account.balance, account.currency]
    );
    
    return NextResponse.json({
      success: true,
      account: result.rows[0]
    });
  } catch (error) {
    console.error('Account creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

// PATCH - Update account
export async function PATCH(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }
    
    // FIXED: Zod validation for partial updates
    const validation = AccountUpdateSchema.safeParse(updates);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }
    
    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT user_id FROM accounts WHERE id = $1',
      [id]
    );
    
    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].user_id !== userId) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    const updateFields: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;
    
    const validatedUpdates = validation.data;
    
    for (const [key, value] of Object.entries(validatedUpdates)) {
      updateFields.push(`${key} = $${paramCount++}`);
      values.push(value);
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    const result = await pool.query(
      `UPDATE accounts SET ${updateFields.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [...values, userId]
    );
    
    return NextResponse.json({
      success: true,
      account: result.rows[0]
    });
  } catch (error) {
    console.error('Account update error:', error);
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

// FIXED: DELETE endpoint (was missing)
export async function DELETE(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json(
      { error: 'Account ID is required' },
      { status: 400 }
    );
  }
  
  try {
    // Soft delete: set is_active = false (preserves trade history)
    const result = await pool.query(
      `UPDATE accounts 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2 
       RETURNING id`,
      [id, userId]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      deletedId: id
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
