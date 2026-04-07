'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCsrfToken, fetchWithCsrf } from '@/hooks/use-csrf-token';
import { Link2, Unplug, CheckCircle2, ChevronDown } from 'lucide-react';

interface SnapTradeAccount {
  id: string;
  name: string;
  number: string;
  institution_name: string;
}

interface SnapTradeState {
  connected: boolean;
  connectedAt: string | null;
  selectedAccount: string | null;
  accounts: SnapTradeAccount[];
}

export function SnapTradeConnectionCard() {
  const [state, setState] = useState<SnapTradeState>({
    connected: false,
    connectedAt: null,
    selectedAccount: null,
    accounts: [],
  });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { token: csrfToken } = useCsrfToken();

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/user/snaptrade/accounts');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error('Failed to fetch SnapTrade accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  // Check for callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const snaptradeStatus = params.get('snaptrade');
    if (snaptradeStatus === 'connected') {
      setSuccess('Broker connected successfully! Fetching accounts...');
      void fetchAccounts();
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    } else if (snaptradeStatus === 'error') {
      setError('Broker connection failed. Please try again.');
      window.history.replaceState({}, '', '/settings');
    }
  }, [fetchAccounts]);

  const handleConnect = async () => {
    setError('');
    setSuccess('');
    setConnecting(true);

    try {
      const res = await fetch('/api/user/snaptrade/connect', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate connection URL');
      }

      // Redirect to SnapTrade portal
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your broker? You will need to reconnect to execute trades via SnapTrade.')) return;
    if (!csrfToken) return;

    setDisconnecting(true);
    setError('');
    try {
      const res = await fetchWithCsrf('/api/user/snaptrade/disconnect', { method: 'POST' }, csrfToken);
      if (res.ok) {
        setSuccess('Broker disconnected.');
        setState({ connected: false, connectedAt: null, selectedAccount: null, accounts: [] });
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to disconnect');
      }
    } catch {
      setError('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSelectAccount = async (accountId: string) => {
    if (!csrfToken) return;
    setError('');

    try {
      const res = await fetchWithCsrf(
        '/api/user/snaptrade/select-account',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId }),
        },
        csrfToken
      );

      if (res.ok) {
        setState((prev) => ({ ...prev, selectedAccount: accountId }));
        setSuccess('Account selected for trading.');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to select account');
      }
    } catch {
      setError('Failed to select account');
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Broker Connection (SnapTrade)
        </CardTitle>
        <CardDescription>
          Connect your brokerage account to execute trades directly from Meridian.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-loss/40 bg-loss/10 p-3 text-sm text-loss">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
            {success}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-border/40 bg-secondary/20 py-6 text-center text-muted-foreground text-sm">
            Loading broker connection...
          </div>
        ) : !state.connected || state.accounts.length === 0 ? (
          // Not connected — show connect button
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-border/50 bg-secondary/15 p-6 text-center">
              <Unplug className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-foreground">No broker connected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect your brokerage account through SnapTrade to enable trade execution.
              </p>
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="mt-4"
              >
                {connecting ? 'Connecting...' : 'Connect Broker'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              SnapTrade supports 15+ brokerages including Interactive Brokers, Alpaca, Tradier, and more.
              Your credentials are stored securely by SnapTrade — never on our servers.
            </p>
          </div>
        ) : (
          // Connected — show accounts
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">Broker Connected</span>
                {state.connectedAt && (
                  <span className="text-xs text-muted-foreground">
                    since {new Date(state.connectedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-loss hover:bg-loss/10"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>

            {/* Account list */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Select Account for Trading
              </p>
              {state.accounts.map((account) => {
                const isSelected = state.selectedAccount === account.id;
                return (
                  <button
                    key={account.id}
                    onClick={() => handleSelectAccount(account.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/40 bg-secondary/20 hover:bg-secondary/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {account.institution_name || account.name}
                        </span>
                        {isSelected && (
                          <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Active
                          </span>
                        )}
                      </div>
                      {account.number && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          ••••{account.number.slice(-4)}
                        </p>
                      )}
                    </div>
                    {!isSelected && (
                      <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Re-connect button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? 'Loading...' : 'Add Another Broker'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
