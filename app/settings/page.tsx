'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentMethodManager } from '@/components/payment-method-form';
import { RiskSettingsCard } from '@/components/risk-settings';
import { SnapTradeConnectionCard } from '@/components/snaptrade-connection';
import { BadgeCheck, CircleAlert, KeyRound, Link2, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCsrfToken, fetchWithCsrf } from '@/hooks/use-csrf-token';

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

  // CSRF token
  const { token: csrfToken, loading: csrfLoading, error: csrfError } = useCsrfToken();

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
    
    if (!csrfToken) {
      setError('Security token not ready. Please wait and try again.');
      return;
    }
    
    setAdding(selectedPlatform);

    try {
      const res = await fetchWithCsrf(
        '/api/user/credentials',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: selectedPlatform,
            api_key: apiKey,
            api_secret: apiSecret || undefined,
            key_name: keyName || undefined,
          }),
        },
        csrfToken
      );

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

    if (!csrfToken) {
      setError('Security token not ready. Please wait and try again.');
      return;
    }

    try {
      const res = await fetchWithCsrf(
        `/api/user/credentials?platform=${encodeURIComponent(platform)}`,
        {
          method: 'DELETE',
        },
        csrfToken
      );

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

  const [userSession, setUserSession] = useState<{ username: string; avatar: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          // Construct full avatar URL if it's just a hash
          const avatarHash = data.user.avatar;
          const discordId = data.user.discordId;
          const fullAvatarUrl = avatarHash 
            ? (avatarHash.startsWith('http') 
                ? avatarHash 
                : `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`)
            : null;
          setUserSession({ username: data.user.username, avatar: fullAvatarUrl });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="hero-section rounded border border-border">
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              {userSession?.avatar && (
                <div className="shrink-0">
                  <Image
                    src={userSession.avatar}
                    alt={userSession.username}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded border border-border"
                    priority
                  />
                </div>
              )}
              <div>
                <p className="data-label">Account Configuration</p>
                <h1 className="mt-1 text-xl font-semibold text-foreground">Settings</h1>
                {userSession && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {userSession.username}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:min-w-60">
              <div className="stat-box rounded">
                <p className="stat-box-label">Connected</p>
                <p className="stat-box-value">{platforms.length}</p>
              </div>
              <div className="stat-box rounded">
                <p className="stat-box-label">Available</p>
                <p className="stat-box-value">{availablePlatforms.length}</p>
              </div>
            </div>
          </div>
        </section>

        <RiskSettingsCard />

        {csrfError && (
          <div className="rounded border border-loss/30 p-2 text-xs text-loss">
            <strong>Security Error:</strong> {csrfError}. Please refresh the page.
          </div>
        )}

        {error && (
          <div className="rounded border border-loss/30 p-2 text-xs text-loss">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded border border-profit/30 p-2 text-xs text-profit">
            {success}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                Connected Platforms
              </CardTitle>
              <CardDescription>Platforms linked to your account.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-start justify-between gap-3 rounded border border-border p-3 animate-pulse">
                      <div className="flex items-start gap-2">
                        <div className="h-8 w-8 rounded bg-muted/30" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-20 rounded bg-muted/30" />
                          <div className="h-2.5 w-32 rounded bg-muted/30" />
                        </div>
                      </div>
                      <div className="h-6 w-16 rounded bg-muted/30" />
                    </div>
                  ))}
                </div>
              ) : platforms.length === 0 ? (
                <div className="rounded border border-dashed border-border py-6 text-center">
                  <p className="text-xs font-medium text-foreground">No platforms connected</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Add a platform below</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {platforms.map((platform) => {
                    const info = platformInfo[platform.platform];
                    const displayName = info?.name || platform.platform;

                    return (
                      <div
                        key={platform.id}
                        className="flex items-start justify-between gap-3 rounded border border-border p-3 hover:border-border/80"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary text-[10px] font-semibold text-foreground">
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-xs font-semibold text-foreground">{displayName}</h3>
                              <span
                                className={cn(
                                  'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
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
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-200 hover:border-primary/40"
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

                    <Button type="submit" disabled={adding === selectedPlatform || csrfLoading || !csrfToken} className="w-full">
                      {adding === selectedPlatform ? 'Verifying...' : csrfLoading ? 'Loading...' : 'Connect Platform'}
                    </Button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        <SnapTradeConnectionCard />

        <PaymentMethodManager />

        <Card className="border-border/50 bg-secondary/25">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-background/60 p-4 transition-all duration-200 hover:border-border/60 hover:bg-background/80">
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

              <div className="rounded-xl border border-border/40 bg-background/60 p-4 transition-all duration-200 hover:border-border/60 hover:bg-background/80">
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
