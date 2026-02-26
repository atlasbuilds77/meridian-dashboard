'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, DollarSign, Wallet, TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccountValue {
  userId: number;
  username: string;
  discordId: string;
  avatar: string | null;
  accountNumber: string | null;
  totalEquity: number | null;
  cashBalance: number | null;
  positionsValue: number | null;
  buyingPower: number | null;
  status: 'success' | 'no_credentials' | 'error';
  error?: string;
  positions?: Array<{
    symbol: string;
    quantity: number;
    costBasis: number;
  }>;
}

interface AccountValuesResponse {
  accounts: AccountValue[];
  totals: {
    totalEquity: number;
    totalCash: number;
    totalPositionsValue: number;
    accountCount: number;
  };
  timestamp: string;
}

function formatUsd(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function StatusBadge({ status, error }: { status: AccountValue['status']; error?: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-profit/15 px-2 py-0.5 text-xs text-profit">
        <CheckCircle className="h-3 w-3" />
        Connected
      </span>
    );
  }
  
  if (status === 'no_credentials') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        No Account
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-loss/15 px-2 py-0.5 text-xs text-loss" title={error}>
      <XCircle className="h-3 w-3" />
      Error
    </span>
  );
}

export function AdminAccountValues() {
  const [data, setData] = useState<AccountValuesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountValues = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/admin/account-values');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch account values');
    } finally {
      setLoading(false);
    }
  }, []);

  // Don't auto-fetch on mount - user clicks Refresh to load
  // (This endpoint makes external API calls, so be conservative)

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">Live Account Values</h2>
        <Button
          onClick={fetchAccountValues}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : data ? 'Refresh' : 'Load Values'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-loss/30 bg-loss/10 p-4 text-sm text-loss">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-6 text-center text-muted-foreground">
          <Wallet className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>Click &quot;Load Values&quot; to fetch live account balances from Tradier</p>
          <p className="mt-1 text-xs">This makes external API calls for each connected user</p>
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="nebula-panel rounded-xl p-4">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                Total Equity
              </div>
              <div className="text-2xl font-bold text-profit">
                {formatUsd(data.totals.totalEquity)}
              </div>
            </div>
            
            <div className="nebula-panel rounded-xl p-4">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                Total Cash
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatUsd(data.totals.totalCash)}
              </div>
            </div>
            
            <div className="nebula-panel rounded-xl p-4">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Positions Value
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatUsd(data.totals.totalPositionsValue)}
              </div>
            </div>
            
            <div className="nebula-panel rounded-xl p-4">
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                Connected Accounts
              </div>
              <div className="text-2xl font-bold text-primary">
                {data.totals.accountCount}
              </div>
            </div>
          </div>

          {/* Individual Accounts Table */}
          <div className="nebula-panel overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-primary/8">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="p-4">User</th>
                    <th className="p-4">Account</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Total Equity</th>
                    <th className="p-4 text-right">Cash</th>
                    <th className="p-4 text-right">Positions</th>
                    <th className="p-4 text-right">Buying Power</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((account) => (
                    <tr
                      key={account.userId}
                      className="border-t border-primary/15 hover:bg-primary/[0.06]"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {account.avatar ? (
                            <img
                              src={
                                account.avatar.startsWith('http')
                                  ? account.avatar
                                  : `https://cdn.discordapp.com/avatars/${account.discordId}/${account.avatar}.png`
                              }
                              alt=""
                              className="h-8 w-8 rounded-full border border-primary/30"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs text-primary">
                              {account.username[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{account.username}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="p-4">
                        {account.accountNumber ? (
                          <span className="font-mono text-sm text-primary">
                            {account.accountNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      
                      <td className="p-4">
                        <StatusBadge status={account.status} error={account.error} />
                      </td>
                      
                      <td className="p-4 text-right">
                        <span className={account.totalEquity ? 'font-semibold text-profit' : 'text-muted-foreground'}>
                          {formatUsd(account.totalEquity)}
                        </span>
                      </td>
                      
                      <td className="p-4 text-right font-mono text-sm">
                        {formatUsd(account.cashBalance)}
                      </td>
                      
                      <td className="p-4 text-right font-mono text-sm">
                        {formatUsd(account.positionsValue)}
                      </td>
                      
                      <td className="p-4 text-right font-mono text-sm">
                        {formatUsd(account.buyingPower)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-right text-xs text-muted-foreground">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
