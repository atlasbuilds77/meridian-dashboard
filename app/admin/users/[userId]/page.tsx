'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils-client';

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
};

function isBullish(direction: string): boolean {
  const normalized = direction.toUpperCase();
  return ['LONG', 'CALL', 'BUY', 'BULL'].includes(normalized);
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = Array.isArray(params?.userId) ? params.userId[0] : (params?.userId as string);

  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserTrades() {
      if (!userId) {
        setError('Invalid user ID');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/admin/users/${userId}/trades`);
        if (res.status === 401) {
          router.push('/login?error=session_expired');
          return;
        }
        if (res.status === 403) {
          setError('Access denied. Admin only.');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch user trades: ${errorText}`);
        }

        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error('User trades fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchUserTrades();
  }, [userId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-primary">Loading user trades...</div>
      </div>
    );
  }

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
      </div>
    </div>
  );
}
