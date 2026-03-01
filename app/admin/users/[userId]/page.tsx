'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, AlertTriangle, DollarSign, CreditCard, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils-client';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCsrfToken } from '@/hooks/use-csrf-token';

type Trade = {
  id: number;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  entry_date: string;
  exit_date: string | null;
  pnl: number;
  pnl_percent: number;
  status: string;
  setup_type: string | null;
  stop_loss: number | null;
  take_profit: number | null;
  entry_reasoning: string | null;
};

type UserData = {
  user: {
    id: number;
    discord_username: string;
    discord_avatar: string | null;
    discord_id: string;
  };
  trades: Trade[];
  stats: {
    total_trades: number;
    wins: number;
    losses: number;
    total_pnl: number;
    win_rate: number;
    avg_win: number;
    avg_loss: number;
  };
  settings?: {
    trading_enabled: boolean;
    size_pct: number;
    max_daily_loss_pct?: number;
  };
};

type ChargeInfo = {
  weekStart: string;
  weekEnd: string;
  totalPnl: number;
  tradeCount: number;
  feeAmount: number;
  hasPaymentMethod: boolean;
  paymentMethod: { brand: string; last4: string } | null;
  billingEnabled: boolean;
  existingCharge: {
    id: number;
    status: string;
    paidAt: string | null;
    paymentIntentId: string | null;
  } | null;
  canCharge: boolean;
  chargeHistory: Array<{
    id: number;
    weekStart: string;
    weekEnd: string;
    totalPnl: number;
    feeAmount: number;
    status: string;
    paidAt: string | null;
    stripeChargeId: string | null;
  }>;
};

function isBullish(direction: string): boolean {
  const normalized = direction.toUpperCase();
  return ['LONG', 'CALL', 'BUY', 'BULL'].includes(normalized);
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Paid</Badge>;
    case 'failed':
      return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case 'waived':
      return <Badge variant="secondary">Waived</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = Array.isArray(params?.userId) ? params.userId[0] : (params?.userId as string);
  const csrfToken = useCsrfToken();

  const [data, setData] = useState<UserData | null>(null);
  const [chargeInfo, setChargeInfo] = useState<ChargeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [chargeLoading, setChargeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFlattenDialog, setShowFlattenDialog] = useState(false);
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isFlattening, setIsFlattening] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [localSettings, setLocalSettings] = useState({
    trading_enabled: false,
    size_pct: 50,
    max_daily_loss_pct: 5,
  });

  const fetchChargeInfo = useCallback(async () => {
    if (!userId) return;
    
    setChargeLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/charge-fee`);
      if (res.ok) {
        const info = await res.json();
        setChargeInfo(info);
      }
    } catch (err) {
      console.error('Failed to fetch charge info:', err);
    } finally {
      setChargeLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    async function fetchUserData() {
      if (!userId) {
        setError('Invalid user ID');
        setLoading(false);
        return;
      }

      try {
        // Fetch trades data
        const tradesRes = await fetch(`/api/admin/users/${userId}/trades`);
        if (tradesRes.status === 401) {
          router.push('/login?error=session_expired');
          return;
        }
        if (tradesRes.status === 403) {
          setError('Access denied. Admin only.');
          setLoading(false);
          return;
        }
        if (!tradesRes.ok) {
          const errorText = await tradesRes.text();
          throw new Error(`Failed to fetch user trades: ${errorText}`);
        }

        const tradesData = await tradesRes.json();
        
        // Fetch user settings from admin users endpoint
        const settingsRes = await fetch('/api/admin/users');
        if (!settingsRes.ok) {
          console.warn('Failed to fetch user settings, using defaults');
        } else {
          const settingsData = await settingsRes.json();
          const userSettings = settingsData.users?.find((u: any) => u.user.id === parseInt(userId));
          
          if (userSettings?.account) {
            setLocalSettings({
              trading_enabled: userSettings.account.trading_enabled || false,
              size_pct: userSettings.account.size_pct || 50,
              max_daily_loss_pct: 5, // Default value, not in current schema
            });
            
            setData({
              ...tradesData,
              settings: {
                trading_enabled: userSettings.account.trading_enabled || false,
                size_pct: userSettings.account.size_pct || 50,
                max_daily_loss_pct: 5,
              },
            });
            return;
          }
        }
        
        // If no settings found, use defaults
        setData(tradesData);
      } catch (err) {
        console.error('User data fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
    fetchChargeInfo();
  }, [userId, fetchChargeInfo]);

  // Update local settings when data changes
  useEffect(() => {
    if (data?.settings) {
      setLocalSettings({
        trading_enabled: data.settings.trading_enabled,
        size_pct: data.settings.size_pct,
        max_daily_loss_pct: data.settings.max_daily_loss_pct || 5,
      });
    }
  }, [data?.settings]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-primary">Loading user trades...</div>
      </div>
    );
  }

  const handleUpdateSettings = async () => {
    if (!userId) return;
    
    if (!csrfToken.token) {
      toastError('Security token not ready. Please refresh the page.');
      return;
    }
    
    setIsUpdatingSettings(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken.token,
        },
        body: JSON.stringify({
          user_id: parseInt(userId),
          trading_enabled: localSettings.trading_enabled,
          size_pct: localSettings.size_pct,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }

      // Update local data
      if (data) {
        setData({
          ...data,
          settings: {
            ...data.settings!,
            trading_enabled: localSettings.trading_enabled,
            size_pct: localSettings.size_pct,
          },
        });
      }

      toastSuccess('User settings updated successfully');
    } catch (err) {
      console.error('Update settings error:', err);
      toastError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleFlattenPositions = async () => {
    if (!userId) return;
    
    if (!csrfToken.token) {
      toastError('Security token not ready. Please refresh the page.');
      return;
    }
    
    setIsFlattening(true);
    try {
      // Note: This endpoint doesn't exist yet, we'll need to create it
      const response = await fetch(`/api/admin/users/${userId}/flatten`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken.token,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to flatten positions');
      }

      toastSuccess('All positions flattened successfully');
      setShowFlattenDialog(false);
      
      // Refresh trades data
      const tradesRes = await fetch(`/api/admin/users/${userId}/trades`);
      if (tradesRes.ok) {
        const tradesData = await tradesRes.json();
        setData((prev) => prev ? { ...prev, ...tradesData } : tradesData);
      }
    } catch (err) {
      console.error('Flatten positions error:', err);
      toastError(err instanceof Error ? err.message : 'Failed to flatten positions');
    } finally {
      setIsFlattening(false);
    }
  };

  const handleChargeFee = async () => {
    if (!userId || !chargeInfo) return;
    
    if (!csrfToken.token) {
      toastError('Security token not ready. Please refresh the page.');
      return;
    }
    
    setIsCharging(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/charge-fee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken.token,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to charge fee');
      }

      toastSuccess(`Successfully charged $${chargeInfo.feeAmount.toFixed(2)} to ${data?.user.discord_username}`);
      setShowChargeDialog(false);
      
      // Refresh charge info
      await fetchChargeInfo();
    } catch (err) {
      console.error('Charge fee error:', err);
      toastError(err instanceof Error ? err.message : 'Failed to charge fee');
    } finally {
      setIsCharging(false);
    }
  };

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-loss">{error || 'User not found'}</div>
      </div>
    );
  }

  const { user, trades, stats } = data;
  const profitFactor =
    stats.avg_loss !== 0 ? Math.abs((stats.avg_win || 0) / (stats.avg_loss || 1)) : (stats.avg_win || 0) > 0 ? 999 : 0;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            {user.discord_avatar ? (
              <img
                src={
                  user.discord_avatar.startsWith('http')
                    ? user.discord_avatar
                    : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png`
                }
                alt=""
                className="h-12 w-12 rounded-full border-2 border-primary/30"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 text-primary text-lg font-bold">
                {user.discord_username[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold nebula-gradient-text">{user.discord_username}</h1>
              <p className="text-sm text-muted-foreground">Trading History</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.total_trades}</div>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${(stats.win_rate || 0) >= 50 ? 'text-profit' : 'text-loss'}`}>
                {(stats.win_rate || 0).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${(stats.total_pnl || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(stats.total_pnl || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Avg Win</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-profit">{formatCurrency(stats.avg_win || 0)}</div>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Profit Factor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{(profitFactor || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly P&L & Billing Section */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Weekly Billing
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Performance fee management for this user
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {chargeLoading ? (
              <div className="text-muted-foreground">Loading billing info...</div>
            ) : chargeInfo ? (
              <>
                {/* Weekly P&L Display */}
                <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Week: {chargeInfo.weekStart} to {chargeInfo.weekEnd}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {chargeInfo.tradeCount} trades
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Weekly P&L</div>
                      <div className={`text-2xl font-bold ${chargeInfo.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatCurrency(chargeInfo.totalPnl)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Fee (10%)</div>
                      <div className={`text-2xl font-bold ${chargeInfo.feeAmount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {chargeInfo.totalPnl > 0 ? formatCurrency(chargeInfo.feeAmount) : '$0.00'}
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Info */}
                  <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      {chargeInfo.hasPaymentMethod && chargeInfo.paymentMethod ? (
                        <span className="text-sm">
                          {chargeInfo.paymentMethod.brand} •••• {chargeInfo.paymentMethod.last4}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No payment method</span>
                      )}
                    </div>
                    {chargeInfo.existingCharge && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">This week:</span>
                        {getStatusBadge(chargeInfo.existingCharge.status)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Charge Button */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {!chargeInfo.hasPaymentMethod && (
                      <span className="text-yellow-500">⚠️ User has no payment method on file</span>
                    )}
                    {chargeInfo.hasPaymentMethod && chargeInfo.totalPnl <= 0 && (
                      <span>No fee due (P&L ≤ $0)</span>
                    )}
                    {chargeInfo.hasPaymentMethod && chargeInfo.totalPnl > 0 && chargeInfo.existingCharge?.status === 'paid' && (
                      <span className="text-emerald-500">✓ Already charged this week</span>
                    )}
                  </div>
                  <Button
                    onClick={() => setShowChargeDialog(true)}
                    disabled={!chargeInfo.canCharge}
                    className="gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    Charge 10% Fee Now
                  </Button>
                </div>

                {/* Charge History Table */}
                {chargeInfo.chargeHistory.length > 0 && (
                  <div className="pt-4 border-t border-primary/10">
                    <h4 className="text-sm font-medium mb-3">Recent Charges</h4>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Week</TableHead>
                          <TableHead className="text-right">P&L</TableHead>
                          <TableHead className="text-right">Fee</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Charge ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chargeInfo.chargeHistory.map((charge) => (
                          <TableRow key={charge.id} className="hover:bg-secondary/30">
                            <TableCell className="font-mono text-sm">
                              {charge.weekStart}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${charge.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {formatCurrency(charge.totalPnl)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(charge.feeAmount)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(charge.status)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {charge.paidAt ? new Date(charge.paidAt).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              {charge.stripeChargeId ? charge.stripeChargeId.slice(-8) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">Unable to load billing info</div>
            )}
          </CardContent>
        </Card>

        {/* Trading Controls */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Trading Controls</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage user trading permissions and risk settings
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trading Enabled Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="trading-enabled" className="text-base font-medium">
                  Trading Enabled
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow this user to execute trades through the system
                </p>
              </div>
              <Switch
                id="trading-enabled"
                checked={localSettings.trading_enabled}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, trading_enabled: checked })
                }
              />
            </div>

            {/* Max Position Size */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="position-size" className="text-base font-medium">
                  Max Position Size
                </Label>
                <span className="text-lg font-bold text-primary">{localSettings.size_pct}%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Maximum percentage of account equity per trade (1-100%)
              </p>
              <div className="pt-2">
                <Slider
                  id="position-size"
                  min={1}
                  max={100}
                  step={1}
                  value={[localSettings.size_pct]}
                  onValueChange={([value]) =>
                    setLocalSettings({ ...localSettings, size_pct: value })
                  }
                  className="w-full"
                />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>1%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Max Daily Loss */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="daily-loss" className="text-base font-medium">
                  Max Daily Loss
                </Label>
                <span className="text-lg font-bold text-primary">{localSettings.max_daily_loss_pct}%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Maximum daily loss percentage before auto-stop (coming soon)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[2, 5, 10, 20].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    variant={localSettings.max_daily_loss_pct === pct ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setLocalSettings({ ...localSettings, max_daily_loss_pct: pct })
                    }
                    className="w-full"
                  >
                    {pct}%
                  </Button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {data.settings ? (
                  <>
                    Current: Trading is{' '}
                    <Badge variant={data.settings.trading_enabled ? 'default' : 'secondary'}>
                      {data.settings.trading_enabled ? 'ENABLED' : 'DISABLED'}
                    </Badge>
                    , Max position: <Badge variant="outline">{data.settings.size_pct}%</Badge>
                  </>
                ) : (
                  'No settings loaded'
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (data.settings) {
                      setLocalSettings({
                        trading_enabled: data.settings.trading_enabled,
                        size_pct: data.settings.size_pct,
                        max_daily_loss_pct: data.settings.max_daily_loss_pct || 5,
                      });
                    }
                  }}
                  disabled={!data.settings || isUpdatingSettings}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleUpdateSettings}
                  disabled={isUpdatingSettings || !data.settings}
                >
                  {isUpdatingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowFlattenDialog(true)}
                  disabled={isFlattening}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Flatten All Positions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trades Table */}
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">All Trades</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {trades.length} trades
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Setup</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Contracts</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">Exit</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">Return %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        No trades yet for this user.
                      </TableCell>
                    </TableRow>
                  ) : (
                    trades.map((trade) => {
                      const bullish = isBullish(trade.direction);
                      const isWin = trade.pnl > 0;

                      return (
                        <TableRow
                          key={trade.id}
                          className="group hover:bg-secondary/30"
                          title={trade.entry_reasoning || undefined}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{new Date(trade.entry_date).toLocaleDateString()}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(trade.entry_date).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {trade.setup_type || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{trade.symbol}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {bullish ? (
                                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4 text-red-500" />
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  bullish
                                    ? 'border-emerald-500/50 text-emerald-500'
                                    : 'border-red-500/50 text-red-500'
                                }
                              >
                                {trade.direction.toUpperCase()}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{trade.quantity || 0}</TableCell>
                          <TableCell className="text-right font-mono">
                            ${(trade.entry_price || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {trade.exit_price ? `$${(trade.exit_price || 0).toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-semibold ${
                              isWin ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {formatCurrency(trade.pnl || 0)}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${isWin ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatPercent(trade.pnl_percent || 0)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Flatten Confirmation Dialog */}
        <Dialog open={showFlattenDialog} onOpenChange={setShowFlattenDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-loss">
                <AlertTriangle className="h-5 w-5" />
                Flatten All Positions
              </DialogTitle>
              <DialogDescription>
                This will immediately close ALL open positions for{' '}
                <span className="font-semibold text-foreground">{user.discord_username}</span>.
                <br />
                <br />
                <span className="font-medium text-loss">
                  This action cannot be undone and may result in realized losses.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setShowFlattenDialog(false)}
                disabled={isFlattening}
                className="sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleFlattenPositions}
                disabled={isFlattening}
                className="sm:flex-1"
              >
                {isFlattening ? 'Flattening...' : 'Confirm Flatten'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Charge Fee Confirmation Dialog */}
        <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Charge Performance Fee
              </DialogTitle>
              <DialogDescription>
                {chargeInfo && (
                  <>
                    Charge <span className="font-semibold text-foreground">${chargeInfo.feeAmount.toFixed(2)}</span> to{' '}
                    <span className="font-semibold text-foreground">{user.discord_username}</span>?
                    <br />
                    <br />
                    This will bill their saved payment method
                    {chargeInfo.paymentMethod && (
                      <span className="text-foreground">
                        {' '}({chargeInfo.paymentMethod.brand} •••• {chargeInfo.paymentMethod.last4})
                      </span>
                    )}.
                    <br />
                    <br />
                    <span className="text-sm">
                      Week: {chargeInfo.weekStart} to {chargeInfo.weekEnd}
                      <br />
                      P&L: {formatCurrency(chargeInfo.totalPnl)} ({chargeInfo.tradeCount} trades)
                    </span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setShowChargeDialog(false)}
                disabled={isCharging}
                className="sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleChargeFee}
                disabled={isCharging}
                className="sm:flex-1"
              >
                {isCharging ? 'Charging...' : `Charge $${chargeInfo?.feeAmount.toFixed(2) || '0.00'}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
