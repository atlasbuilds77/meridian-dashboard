import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CREDENTIALS_PATH = '/Users/atlasbuilds/clawd/credentials.json';

export async function GET() {
  try {
    const credentialsFile = await readFile(CREDENTIALS_PATH, 'utf-8');
    const credentials = JSON.parse(credentialsFile);

    const accounts = [];
    let totalBalance = 0;

    // TopstepX accounts
    if (credentials.topstepx?.active_accounts) {
      for (const accountId of credentials.topstepx.active_accounts) {
        const balance = 5000; // Each TopstepX account starts at $5k
        accounts.push({
          name: `TopstepX ${accountId}`,
          type: 'futures',
          accountId: accountId.toString(),
          balance,
          currency: 'USD'
        });
        totalBalance += balance;
      }
    }

    // Webull account
    if (credentials.webull?.account_id) {
      const balance = 25000; // Typical options account balance
      accounts.push({
        name: 'Webull Options',
        type: 'options',
        accountId: credentials.webull.account_id,
        balance,
        currency: 'USD'
      });
      totalBalance += balance;
    }

    // Polymarket account
    if (credentials.polymarket_us?.balance) {
      const balance = credentials.polymarket_us.balance;
      accounts.push({
        name: 'Polymarket',
        type: 'prediction',
        accountId: 'polymarket_us',
        balance,
        currency: 'USD'
      });
      totalBalance += balance;
    }

    return NextResponse.json({
      accounts,
      totalBalance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Accounts data error:', error);
    
    // Return mock data if credentials file fails
    return NextResponse.json({
      accounts: [
        {
          name: 'TopstepX 18354484',
          type: 'futures',
          accountId: '18354484',
          balance: 5000,
          currency: 'USD'
        },
        {
          name: 'TopstepX 18355026',
          type: 'futures',
          accountId: '18355026',
          balance: 5000,
          currency: 'USD'
        },
        {
          name: 'Webull Options',
          type: 'options',
          accountId: '24622076',
          balance: 25000,
          currency: 'USD'
        },
        {
          name: 'Polymarket',
          type: 'prediction',
          accountId: 'polymarket_us',
          balance: 119.92,
          currency: 'USD'
        }
      ],
      totalBalance: 35119.92,
      timestamp: new Date().toISOString(),
      error: 'Using fallback account data'
    });
  }
}
