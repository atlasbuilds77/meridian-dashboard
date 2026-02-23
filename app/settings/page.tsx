'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentMethodManager } from '@/components/payment-method-form';
import { RiskSettingsCard } from '@/components/risk-settings';
import { BadgeCheck, CircleAlert, KeyRound, Link2, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Platform {
  id: number;
  platform: string;
  key_name: string;
  verification_status: 'pending' | 'verified' | 'failed';
  last_verified?: string;
  error_message?: string;
  created_at: string;
}

type PlatformInfo = {
  name: string;
  description: string;
  needsSecret: boolean;
  keyLabel: string;
  secretLabel?: string;
};

const platformInfo: Record<string, PlatformInfo> = {
  tradier: {
    name: 'Tradier',
    description: 'Options and stocks trading account',
    needsSecret: false,
    keyLabel: 'API Token',
  },
  polymarket: {
    name: 'Polymarket',
    description: 'Prediction market wallet',
    needsSecret: false,
    keyLabel: 'Wallet Address (0x...)',
  },
  topstepx: {
    name: 'TopstepX',
    description: 'Futures trading account',
    needsSecret: true,
    keyLabel: 'API Key',
    secretLabel: 'API Secret',
  },
  webull: {
    name: 'Webull',
    description: 'Trading account',
    needsSecret: true,
    keyLabel: 'API Key',
    secretLabel: 'API Secret',
  },
};

function verificationBadgeClass(status: Platform['verification_status']): string {
  switch (status) {
    case 'verified':
      return 'border-primary/35 bg-primary/15 text-primary';
    case 'failed':
      return 'border-loss/30 bg-loss/15 text-loss';
    default:
      return 'border-border/40 bg-secondary/60 text-muted-foreground';
  }
}

export default function SettingsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  // Form state
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [keyName, setKeyName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPlatforms = useCallback(async () => {
    try {
      const res = await fetch('/api/user/credentials');
      if (res.ok) {
        const data = await res.json();
        setPlatforms(data.platforms || []);
      }
    } catch (err) {
      console.error('Failed to fetch platforms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlatforms();
  }, [fetchPlatforms]);

  const handleAddPlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAdding(selectedPlatform);

    try {
      const res = await fetch('/api/user/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          api_key: apiKey,
          api_secret: apiSecret || undefined,
          key_name: keyName || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add API key');
      }

      setSuccess(`${platformInfo[selectedPlatform]?.name || selectedPlatform} API key verified and added successfully.`);
      setApiKey('');
      setApiSecret('');
      setKeyName('');
      setSelectedPlatform('');
      void fetchPlatforms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add API key');
    } finally {
      setAdding(null);
    }
  };

  const handleDeletePlatform = async (platform: string) => {
    if (!confirm(`Remove ${platform} API key?`)) return;

    try {
      const res = await fetch(`/api/user/credentials?platform=${encodeURIComponent(platform)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSuccess(`${platformInfo[platform]?.name || platform} API key removed.`);
        void fetchPlatforms();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove API key');
      }
    } catch {
      setError('Failed to remove API key');
    }
  };

  const connectedSet = new Set(platforms.map((platform) => platform.platform));
  const availablePlatforms = Object.entries(platformInfo).filter(([platform]) => !connectedSet.has(platform));
  const selectedPlatformInfo = selectedPlatform ? platformInfo[selectedPlatform] : undefined;

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-secondary/60 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/90">Account Configuration</p>
              <h1 className="mt-2 text-3xl font-bold text-foreground">Settings</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Connect your trading platforms and billing method once. Meridian validates keys before enabling automation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-80">
              <div className="rounded-xl border border-border/40 bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Connected</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{platforms.length}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Available</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{availablePlatforms.length}</p>
              </div>
            </div>
          </div>
        </section>

        <RiskSettingsCard />

        {error && (
          <div className="rounded-xl border border-loss/40 bg-loss/10 p-3 text-sm text-loss">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
            {success}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Connected Platforms
              </CardTitle>
              <CardDescription>Platforms currently linked to your Meridian account.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="rounded-xl border border-border/40 bg-secondary/20 py-8 text-center text-muted-foreground">
                  Loading connected platforms...
                </div>
              ) : platforms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 bg-secondary/15 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">No platforms connected yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Use the Add Platform form to connect your first account.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {platforms.map((platform) => {
                    const info = platformInfo[platform.platform];
                    const displayName = info?.name || platform.platform;

                    return (
                      <div
                        key={platform.id}
                        className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-sm font-semibold text-foreground">
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-foreground">{displayName}</h3>
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
                                  verificationBadgeClass(platform.verification_status)
                                )}
                              >
                                {platform.verification_status}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm text-muted-foreground">{platform.key_name}</p>
                            {platform.last_verified && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Last verified: {new Date(platform.last_verified).toLocaleString()}
                              </p>
                            )}
                            {platform.error_message && (
                              <p className="mt-1 text-xs text-loss">{platform.error_message}</p>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePlatform(platform.platform)}
                          className="text-loss hover:bg-loss/10"
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Add Platform
              </CardTitle>
              <CardDescription>
                Connect a new trading account or wallet. Credentials are encrypted server-side.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPlatform} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="platform">Platform</Label>
                  <select
                    id="platform"
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Select a platform...</option>
                    {Object.entries(platformInfo).map(([key, info]) => (
                      <option key={key} value={key} disabled={connectedSet.has(key)}>
                        {info.name} - {info.description}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPlatformInfo && (
                  <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{selectedPlatformInfo.name}</p>
                    <p className="mt-1">{selectedPlatformInfo.description}</p>
                  </div>
                )}

                {selectedPlatform && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="apiKey">{selectedPlatformInfo?.keyLabel || 'API Key'}</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your credential"
                        required
                      />
                    </div>

                    {selectedPlatformInfo?.needsSecret && (
                      <div className="space-y-1.5">
                        <Label htmlFor="apiSecret">{selectedPlatformInfo?.secretLabel || 'API Secret'}</Label>
                        <Input
                          id="apiSecret"
                          type="password"
                          value={apiSecret}
                          onChange={(e) => setApiSecret(e.target.value)}
                          placeholder="Enter your API secret"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="keyName">Nickname (optional)</Label>
                      <Input
                        id="keyName"
                        type="text"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        placeholder="Main account"
                      />
                    </div>

                    <Button type="submit" disabled={adding === selectedPlatform} className="w-full">
                      {adding === selectedPlatform ? 'Verifying...' : 'Connect Platform'}
                    </Button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        <PaymentMethodManager />

        <Card className="border-border/50 bg-secondary/25">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lock className="h-4 w-4 text-primary" />
                  Security and Privacy
                </h4>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <li>All API keys are encrypted with AES-256-GCM.</li>
                  <li>Keys are stored server-side and never returned to your browser.</li>
                  <li>All credential operations are logged for auditing.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Access and Billing
                </h4>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <li>Automation is only enabled after platform verification succeeds.</li>
                  <li>Payment methods are secured by Stripe (PCI-DSS compliant).</li>
                  <li>Weekly billing applies only on profitable weeks.</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Keep at least one verified platform and one active payment method to avoid interruptions.
              </p>
              <p className="mt-2 flex items-start gap-2">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-loss" />
                If a key fails verification, remove it and reconnect with fresh credentials.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
