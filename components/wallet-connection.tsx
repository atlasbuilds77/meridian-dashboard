'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCsrfToken, fetchWithCsrf } from '@/hooks/use-csrf-token';
import { useLiveData } from '@/hooks/use-live-data';
import {
  Wallet,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  DollarSign,
  Fuel,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';

interface WalletBalanceData {
  connected: boolean;
  walletAddress?: string;
  balances?: {
    usdc: number | null;
    matic: number | null;
  };
  hasGas?: boolean;
  error?: string;
}

interface WalletConnectionProps {
  compact?: boolean;
}

export function WalletConnection({ compact = false }: WalletConnectionProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  
  const [savedWallet, setSavedWallet] = useState<string | null>(null);
  const [hasApiCreds, setHasApiCreds] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const { token: csrfToken, loading: csrfLoading } = useCsrfToken();

  // Live wallet balance polling (every 45 seconds)
  const { data: balanceData } = useLiveData<WalletBalanceData>(
    '/api/prediction-markets/wallet-balance',
    45_000
  );

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch('/api/user/credentials');
      if (res.ok) {
        const data = await res.json();
        const polymarketPlatform = (data.platforms || []).find(
          (p: { platform: string }) => p.platform === 'polymarket'
        );
        if (polymarketPlatform) {
          setSavedWallet(polymarketPlatform.key_name || 'Connected');
          setHasApiCreds(!!polymarketPlatform.api_secret);
        }
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!walletAddress.startsWith('0x') || walletAddress.length < 42) {
      setError('Please enter a valid Ethereum wallet address (0x...)');
      return;
    }

    if (!apiKey || !apiSecret) {
      setError('API Key and API Secret are required for copy-trading.');
      return;
    }

    if (!csrfToken) {
      setError('Security token not ready. Please wait and try again.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithCsrf(
        '/api/user/credentials',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'polymarket',
            api_key: apiKey,
            api_secret: apiSecret,
            key_name: walletAddress,
            // Store passphrase in metadata or separate field
            metadata: JSON.stringify({ passphrase, walletAddress }),
          }),
        },
        csrfToken
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save credentials');
      }

      setSuccess('Polymarket credentials saved. Copy-trading enabled!');
      setSavedWallet(walletAddress);
      setHasApiCreds(true);
      setWalletAddress('');
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Polymarket wallet and remove API credentials?')) return;
    if (!csrfToken) return;

    try {
      const res = await fetchWithCsrf(
        '/api/user/credentials?platform=polymarket',
        { method: 'DELETE' },
        csrfToken
      );
      if (res.ok) {
        setSavedWallet(null);
        setHasApiCreds(false);
        setSuccess('Wallet and credentials removed.');
      }
    } catch {
      setError('Failed to disconnect wallet');
    }
  };

  const handleCopy = () => {
    if (savedWallet) {
      navigator.clipboard.writeText(savedWallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateAddress = (addr: string) => {
    if (addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card className={cn('border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur', compact && 'border-border/50')}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="h-10 rounded-lg bg-white/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const usdcBalance = balanceData?.balances?.usdc;
  const maticBalance = balanceData?.balances?.matic;
  const hasLowGas = maticBalance !== null && maticBalance !== undefined && maticBalance < 0.01;

  // Connected state
  if (savedWallet) {
    return (
      <Card className={cn('border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur', compact && 'border-border/50')}>
        <CardHeader className="border-b border-primary/20 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Wallet className="h-5 w-5 text-primary" />
              Polymarket Wallet
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasApiCreds && (
                <Badge className="bg-profit/20 text-profit border-profit/30 text-[10px]">
                  COPY-TRADING ENABLED
                </Badge>
              )}
              <Badge className="bg-primary/20 text-primary border-primary/30">Connected</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Wallet Address */}
          <div className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet Address</p>
                <p className="font-mono text-sm font-semibold text-foreground">{truncateAddress(savedWallet)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="rounded-lg border border-border/50 bg-secondary/50 p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {copied ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
              </button>
              <a
                href={`https://polygonscan.com/address/${savedWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border/50 bg-secondary/50 p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Balances */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/40 bg-secondary/30 p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-profit" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">USDC Balance</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">
                {usdcBalance !== null && usdcBalance !== undefined
                  ? `$${usdcBalance.toFixed(2)}`
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-secondary/30 p-3">
              <div className="flex items-center gap-2">
                <Fuel className="h-4 w-4 text-amber-500" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Gas (POL)</span>
                {hasLowGas && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0">LOW</Badge>
                )}
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">
                {maticBalance !== null && maticBalance !== undefined
                  ? maticBalance.toFixed(4)
                  : '—'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-profit" />
              <span>Credentials encrypted & secure</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="text-loss hover:text-loss hover:bg-loss/10"
            >
              Disconnect
            </Button>
          </div>

          {success && (
            <p className="text-xs text-profit">{success}</p>
          )}
          {error && (
            <p className="text-xs text-loss">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Not connected - show form
  return (
    <Card className={cn('border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur', compact && 'border-border/50')}>
      <CardHeader className="border-b border-primary/20 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Key className="h-5 w-5 text-primary" />
          Connect Polymarket
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Enter your wallet address and API credentials to enable copy-trading.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Wallet Address */}
          <div className="space-y-2">
            <Label htmlFor="wallet" className="text-sm font-medium">
              Wallet Address <span className="text-loss">*</span>
            </Label>
            <Input
              id="wallet"
              type="text"
              placeholder="0x..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="font-mono text-sm bg-secondary/30 border-border/50"
              required
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium">
              API Key <span className="text-loss">*</span>
            </Label>
            <Input
              id="apiKey"
              type="text"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm bg-secondary/30 border-border/50"
              required
            />
          </div>

          {/* API Secret */}
          <div className="space-y-2">
            <Label htmlFor="apiSecret" className="text-sm font-medium">
              API Secret <span className="text-loss">*</span>
            </Label>
            <div className="relative">
              <Input
                id="apiSecret"
                type={showSecret ? 'text' : 'password'}
                placeholder="Your API secret..."
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="font-mono text-sm bg-secondary/30 border-border/50 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Passphrase */}
          <div className="space-y-2">
            <Label htmlFor="passphrase" className="text-sm font-medium">
              Passphrase <span className="text-muted-foreground text-xs">(if set)</span>
            </Label>
            <div className="relative">
              <Input
                id="passphrase"
                type={showPassphrase ? 'text' : 'password'}
                placeholder="Optional passphrase..."
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="font-mono text-sm bg-secondary/30 border-border/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Security Note */}
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
            <p className="flex items-start gap-2 text-xs text-primary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your credentials are encrypted with AES-256 and stored securely. We use them only to execute copy-trades. You can revoke access anytime.</span>
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-loss/30 bg-loss/10 p-3">
              <p className="flex items-center gap-2 text-xs text-loss">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-profit/30 bg-profit/10 p-3">
              <p className="flex items-center gap-2 text-xs text-profit">
                <Check className="h-4 w-4" />
                {success}
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={saving || csrfLoading}
            className="w-full"
          >
            {saving ? 'Connecting...' : 'Connect & Enable Copy-Trading'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
