'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCsrfToken, fetchWithCsrf } from '@/hooks/use-csrf-token';
import { Link2, Unplug, CheckCircle2, ChevronDown, Zap, AlertTriangle } from 'lucide-react';

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
  heliosAccount: string | null;
  meridianAccount: string | null;
  heliosAutoExecute: boolean;
  meridianAutoExecute: boolean;
  accounts: SnapTradeAccount[];
}

type TradingSystem = 'helios' | 'meridian';

export function SnapTradeConnectionCard() {
  const [state, setState] = useState<SnapTradeState>({
    connected: false,
    connectedAt: null,
    selectedAccount: null,
    heliosAccount: null,
    meridianAccount: null,
    heliosAutoExecute: false,
    meridianAutoExecute: false,
    accounts: [],
  });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [togglingSystem, setTogglingSystem] = useState<TradingSystem | null>(null);

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
        setState({
          connected: false,
          connectedAt: null,
          selectedAccount: null,
          heliosAccount: null,
          meridianAccount: null,
          heliosAutoExecute: false,
          meridianAutoExecute: false,
          accounts: [],
        });
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

  const handleSelectSystemAccount = async (system: TradingSystem, accountId: string) => {
    if (!csrfToken) return;
    setError('');

    try {
      const res = await fetchWithCsrf(
        '/api/user/snaptrade/select-system-account',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system, accountId }),
        },
        csrfToken
      );

      if (res.ok) {
        setState((prev) => ({
          ...prev,
          [system === 'helios' ? 'heliosAccount' : 'meridianAccount']: accountId,
        }));
        const label = system === 'helios' ? 'Helios' : 'Meridian';
        setSuccess(`${label} account updated.`);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to select account');
      }
    } catch {
      setError('Failed to select account');
    }
  };

  const handleToggleAutoExecute = async (system: TradingSystem) => {
    if (!csrfToken) return;
    const currentValue = system === 'helios' ? state.heliosAutoExecute : state.meridianAutoExecute;
    const newValue = !currentValue;
    setTogglingSystem(system);
    setError('');
    setSuccess('');

    try {
      const res = await fetchWithCsrf(
        '/api/user/settings/auto-execute',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system, enabled: newValue }),
        },
        csrfToken
      );
      const data = await res.json();
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          [system === 'helios' ? 'heliosAutoExecute' : 'meridianAutoExecute']: newValue,
        }));
        const label = system === 'helios' ? 'Helios' : 'Meridian';
        setSuccess(newValue ? `${label} auto-execute enabled.` : `${label} auto-execute disabled.`);
      } else {
        setError(data.error || 'Failed to toggle auto-execute');
      }
    } catch {
      setError('Failed to toggle auto-execute');
    } finally {
      setTogglingSystem(null);
    }
  };

  const sameAccountWarning =
    state.heliosAccount &&
    state.meridianAccount &&
    state.heliosAccount === state.meridianAccount;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Broker Connection (SnapTrade)
        </CardTitle>
        <CardDescription>
          Connect your brokerage account and assign accounts to each trading system.
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
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-border/50 bg-secondary/15 p-6 text-center">
              <Unplug className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-foreground">No broker connected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect your brokerage account through SnapTrade to enable trade execution.
              </p>
              <Button onClick={handleConnect} disabled={connecting} className="mt-4">
                {connecting ? 'Connecting...' : 'Connect Broker'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              SnapTrade supports 15+ brokerages including Interactive Brokers, Alpaca, Tradier, and more.
              Your credentials are stored securely by SnapTrade — never on our servers.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connection header */}
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

            {/* Same account warning */}
            {sameAccountWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  ⚠️ Using the same account for both systems may cause position conflicts.
                  Consider assigning different accounts if possible.
                </span>
              </div>
            )}

            {/* System Account Selectors */}
            <SystemAccountSelector
              system="helios"
              label="Helios Account"
              description="Swing options signals — multi-day holds"
              accounts={state.accounts}
              selectedAccountId={state.heliosAccount}
              autoExecuteEnabled={state.heliosAutoExecute}
              togglingAutoExecute={togglingSystem === 'helios'}
              csrfToken={csrfToken}
              onSelectAccount={(accountId) => handleSelectSystemAccount('helios', accountId)}
              onToggleAutoExecute={() => handleToggleAutoExecute('helios')}
            />

            <SystemAccountSelector
              system="meridian"
              label="Meridian Account"
              description="0DTE / intraday options — same-day expiry"
              accounts={state.accounts}
              selectedAccountId={state.meridianAccount}
              autoExecuteEnabled={state.meridianAutoExecute}
              togglingAutoExecute={togglingSystem === 'meridian'}
              csrfToken={csrfToken}
              onSelectAccount={(accountId) => handleSelectSystemAccount('meridian', accountId)}
              onToggleAutoExecute={() => handleToggleAutoExecute('meridian')}
            />

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

// --- Sub-component: per-system account selector + auto-execute toggle ---

interface SystemAccountSelectorProps {
  system: TradingSystem;
  label: string;
  description: string;
  accounts: SnapTradeAccount[];
  selectedAccountId: string | null;
  autoExecuteEnabled: boolean;
  togglingAutoExecute: boolean;
  csrfToken: string | null;
  onSelectAccount: (accountId: string) => void;
  onToggleAutoExecute: () => void;
}

function SystemAccountSelector({
  system,
  label,
  description,
  accounts,
  selectedAccountId,
  autoExecuteEnabled,
  togglingAutoExecute,
  csrfToken,
  onSelectAccount,
  onToggleAutoExecute,
}: SystemAccountSelectorProps) {
  const accentColor = system === 'helios' ? 'text-amber-500' : 'text-primary';

  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 p-4 space-y-3">
      <div>
        <h3 className={`text-sm font-semibold ${accentColor}`}>{label}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Account list */}
      <div className="space-y-1.5">
        {accounts.map((account) => {
          const isSelected = selectedAccountId === account.id;
          return (
            <button
              key={account.id}
              onClick={() => onSelectAccount(account.id)}
              className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left transition-colors ${
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

      {/* Auto-Execute Toggle */}
      {selectedAccountId && (
        <div className="rounded-lg border border-border/30 bg-background/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${autoExecuteEnabled ? accentColor : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm font-medium text-foreground">Auto-Execute</p>
                <p className="text-xs text-muted-foreground">
                  Auto-execute {label.replace(' Account', '')} signals
                </p>
              </div>
            </div>
            <button
              onClick={onToggleAutoExecute}
              disabled={togglingAutoExecute || !csrfToken}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                autoExecuteEnabled ? 'bg-primary' : 'bg-secondary'
              } ${togglingAutoExecute ? 'opacity-50' : ''}`}
              role="switch"
              aria-checked={autoExecuteEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  autoExecuteEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {autoExecuteEnabled && (
            <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-primary">
              ⚡ Active — {label.replace(' Account', '')} signals will be auto-executed on this account.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
