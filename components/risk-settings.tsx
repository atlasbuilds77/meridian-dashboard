'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RiskSettings {
  trading_enabled: boolean;
  size_pct: number;
  max_position_size: number | null;
  max_daily_loss: number | null;
}

export function RiskSettingsCard() {
  const [settings, setSettings] = useState<RiskSettings>({
    trading_enabled: true,
    size_pct: 1.0,
    max_position_size: null,
    max_daily_loss: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/user/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          trading_enabled: data.trading_enabled,
          size_pct: data.size_pct,
          max_position_size: data.max_position_size,
          max_daily_loss: data.max_daily_loss ?? null,
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSuccess('Risk settings saved successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function getRiskLevel(pct: number): { label: string; color: string } {
    if (pct <= 0.10) return { label: 'Very Conservative', color: 'text-blue-400' };
    if (pct <= 0.25) return { label: 'Conservative', color: 'text-green-400' };
    if (pct <= 0.50) return { label: 'Moderate', color: 'text-yellow-400' };
    if (pct <= 0.75) return { label: 'Aggressive', color: 'text-orange-400' };
    return { label: 'Maximum', color: 'text-red-400' };
  }

  const riskLevel = getRiskLevel(settings.size_pct);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Risk Management
        </CardTitle>
        <CardDescription>Control how much of your account is risked per trade</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trading Enabled Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 p-4">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Auto-Trading Enabled</Label>
            <div className="text-sm text-muted-foreground">
              Allow Meridian to execute trades on your account
            </div>
          </div>
          <Switch
            checked={settings.trading_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, trading_enabled: checked }))
            }
          />
        </div>

        {/* Risk Percentage Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Position Size</Label>
            <div className={cn('flex items-center gap-2 text-sm font-semibold', riskLevel.color)}>
              <TrendingUp className="size-4" />
              {riskLevel.label}
            </div>
          </div>

          <div className="space-y-3">
            <Slider
              value={[settings.size_pct * 100]}
              onValueChange={([value]) =>
                setSettings((prev) => ({ ...prev, size_pct: value / 100 }))
              }
              min={1}
              max={100}
              step={1}
              className="py-4"
            />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Risk per trade:</span>
              <span className="font-mono text-base font-semibold">{(settings.size_pct * 100).toFixed(0)}%</span>
            </div>

            <div className="rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
              <strong>Example:</strong> With $10,000 account balance and {(settings.size_pct * 100).toFixed(0)}%
              risk, Meridian will use ${(10000 * settings.size_pct).toFixed(0)} per trade (80% in 0DTE, 20%
              in 1DTE).
            </div>
          </div>
        </div>

        {/* Max Position Size (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="maxSize">Max Position Size (Optional)</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="maxSize"
                type="number"
                placeholder="No limit"
                value={settings.max_position_size ?? ''}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    max_position_size: e.target.value ? parseFloat(e.target.value) : null,
                  }))
                }
                className="pl-7"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Hard cap on position size regardless of account balance. Leave empty for no limit.
          </p>
        </div>

        {/* Max Daily Loss (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="maxDailyLoss">Max Daily Loss (Optional)</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="maxDailyLoss"
                type="number"
                placeholder="No limit"
                value={settings.max_daily_loss ?? ''}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    max_daily_loss: e.target.value ? parseFloat(e.target.value) : null,
                  }))
                }
                className="pl-7"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Optional daily loss limit. Meridian should stop trading for the day if this limit is hit.
          </p>
        </div>

        {/* Warning */}
        {settings.size_pct > 0.5 && (
          <div className="flex gap-3 rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
            <AlertTriangle className="size-5 shrink-0 text-orange-400" />
            <div className="space-y-1 text-sm">
              <div className="font-medium text-orange-400">High Risk Warning</div>
              <div className="text-orange-400/80">
                Risking more than 50% per trade can lead to significant losses. Consider reducing your
                position size for better risk management.
              </div>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{success}</div>
        )}

        {/* Save Button */}
        <Button onClick={saveSettings} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Risk Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
