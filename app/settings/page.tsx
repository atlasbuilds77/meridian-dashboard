'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Platform {
  id: number;
  platform: string;
  key_name: string;
  verification_status: 'pending' | 'verified' | 'failed';
  last_verified?: string;
  error_message?: string;
  created_at: string;
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

  useEffect(() => {
    fetchPlatforms();
  }, []);

  const fetchPlatforms = async () => {
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
  };

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

      setSuccess(`${selectedPlatform} API key verified and added successfully!`);
      setApiKey('');
      setApiSecret('');
      setKeyName('');
      setSelectedPlatform('');
      fetchPlatforms();
    } catch (err: any) {
      setError(err.message || 'Failed to add API key');
    } finally {
      setAdding(null);
    }
  };

  const handleDeletePlatform = async (platform: string) => {
    if (!confirm(`Remove ${platform} API key?`)) return;

    try {
      const res = await fetch(`/api/user/credentials?platform=${platform}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSuccess(`${platform} API key removed`);
        fetchPlatforms();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove API key');
      }
    } catch (err) {
      setError('Failed to remove API key');
    }
  };

  const platformInfo: Record<string, { name: string; description: string; needsSecret: boolean; keyLabel: string; secretLabel?: string }> = {
    tradier: {
      name: 'Tradier',
      description: 'Options & stocks trading account',
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

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your trading account API keys. All keys are encrypted and stored securely.
          </p>
        </div>

        {/* Connected Platforms */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Connected Platforms</CardTitle>
            <CardDescription>
              Platforms you've connected to Meridian Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : platforms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No platforms connected yet. Add one below to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {platforms.map((platform) => (
                  <div
                    key={platform.id}
                    className="flex items-center justify-between p-4 border border-border/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-foreground">
                          {platformInfo[platform.platform]?.name || platform.platform}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            platform.verification_status === 'verified'
                              ? 'bg-profit/20 text-profit'
                              : platform.verification_status === 'failed'
                              ? 'bg-loss/20 text-loss'
                              : 'bg-secondary/50 text-muted-foreground'
                          }`}
                        >
                          {platform.verification_status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{platform.key_name}</p>
                      {platform.last_verified && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last verified: {new Date(platform.last_verified).toLocaleString()}
                        </p>
                      )}
                      {platform.error_message && (
                        <p className="text-xs text-loss mt-1">{platform.error_message}</p>
                      )}
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add New Platform */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Add Platform</CardTitle>
            <CardDescription>
              Connect a new trading account or wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddPlatform} className="space-y-4">
              {/* Platform Selection */}
              <div>
                <Label htmlFor="platform">Platform</Label>
                <select
                  id="platform"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full mt-1.5 p-2 bg-background border border-border rounded-lg text-foreground"
                  required
                >
                  <option value="">Select a platform...</option>
                  {Object.entries(platformInfo).map(([key, info]) => (
                    <option key={key} value={key} disabled={platforms.some(p => p.platform === key)}>
                      {info.name} - {info.description}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlatform && (
                <>
                  {/* API Key */}
                  <div>
                    <Label htmlFor="apiKey">
                      {platformInfo[selectedPlatform]?.keyLabel || 'API Key'}
                    </Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      className="mt-1.5"
                      required
                    />
                  </div>

                  {/* API Secret (if needed) */}
                  {platformInfo[selectedPlatform]?.needsSecret && (
                    <div>
                      <Label htmlFor="apiSecret">
                        {platformInfo[selectedPlatform]?.secretLabel || 'API Secret'}
                      </Label>
                      <Input
                        id="apiSecret"
                        type="password"
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        placeholder="Enter your API secret"
                        className="mt-1.5"
                      />
                    </div>
                  )}

                  {/* Key Name (optional) */}
                  <div>
                    <Label htmlFor="keyName">Nickname (optional)</Label>
                    <Input
                      id="keyName"
                      type="text"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="My Trading Account"
                      className="mt-1.5"
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={adding === selectedPlatform}
                    className="w-full"
                  >
                    {adding === selectedPlatform ? 'Verifying...' : 'Add Platform'}
                  </Button>
                </>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 bg-loss/10 border border-loss/30 rounded-lg text-loss text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-profit/10 border border-profit/30 rounded-lg text-profit text-sm">
                  {success}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card className="border-border/50 bg-secondary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-profit mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Security & Privacy</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• All API keys are encrypted with AES-256-GCM</li>
                  <li>• Meridian executes trades on your behalf when enabled by admin</li>
                  <li>• Keys are stored securely and never sent to your browser</li>
                  <li>• All operations are logged for security compliance</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
