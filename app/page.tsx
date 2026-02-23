'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useTradeData, useMarketData, useAccountData, useSystemStatus } from '@/hooks/use-live-data';
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils-client';

type DashboardTrade = {
  symbol?: string;
  direction?: string;
  status?: string;
  created_at?: string;
  entry_price?: number | string | null;
  pnl?: number | string | null;
  profit_loss?: number | string | null;
};

function parseNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function isBullishDirection(direction: string): boolean {
  return ['LONG', 'CALL', 'BUY'].includes(direction.toUpperCase());
}

function LiveIndicator({ lastUpdate }: { lastUpdate: Date | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!lastUpdate) return null;

  const secondsAgo = Math.floor((now - lastUpdate.getTime()) / 1000);
  const isLive = secondsAgo < 60;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs text-muted-foreground">
      <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-profit animate-pulse' : 'bg-muted-foreground'}`} />
      <span>{isLive ? 'Live' : `${secondsAgo}s ago`}</span>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-6">
        <div className="mb-4 h-8 w-32 rounded bg-white/10" />
        <div className="h-12 w-48 rounded bg-white/10" />
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-loss/50 bg-loss/10">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 text-loss">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioHeader() {
  const { data: trades, loading: tradesLoading, error: tradesError } = useTradeData();
  const { data: accounts, loading: accountsLoading } = useAccountData();
  const { data: market, lastUpdate } = useMarketData('QQQ');

  if (tradesLoading || accountsLoading) {
    return <LoadingCard />;
  }

  if (tradesError || !trades) {
    return <ErrorCard message="Failed to load portfolio data" />;
  }

  const totalPnL = trades.summary.totalPnL || 0;
  const accountBalance = accounts?.totalBalance || 0;
  const totalValue = accountBalance + totalPnL;
  const totalReturn = accountBalance > 0 ? (totalPnL / accountBalance) * 100 : 0;
  const isPositive = totalPnL >= 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/35 bg-[rgba(19,19,28,0.78)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative z-10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Portfolio Value</p>
          <LiveIndicator lastUpdate={lastUpdate} />
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <h1 className={`text-4xl font-bold tracking-tight sm:text-6xl ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(totalValue)}
          </h1>

          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
            {isPositive ? <ArrowUpRight className="h-5 w-5 text-profit" /> : <ArrowDownRight className="h-5 w-5 text-loss" />}
            <span className={`text-lg font-semibold sm:text-2xl ${isPositive ? 'text-profit' : 'text-loss'}`}>
              {formatPercent(totalReturn)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <div className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm text-muted-foreground">
            P&amp;L:{' '}
            <span className={`font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>{formatCurrency(totalPnL)}</span>
          </div>

          {market && (
            <div className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm text-muted-foreground">
              QQQ: <span className="font-semibold text-foreground">${market.price.toFixed(2)}</span>{' '}
              <span className={market.change >= 0 ? 'text-profit' : 'text-loss'}>
                {market.change >= 0 ? '+' : ''}
                {market.changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatsGrid() {
  const { data: trades, loading, error } = useTradeData();
  const { data: status } = useSystemStatus();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <LoadingCard key={item} />
        ))}
      </div>
    );
  }

  if (error || !trades) {
    return <ErrorCard message="Failed to load statistics" />;
  }

  const summary = trades.summary;
  const meridianOnline = status?.systems.meridian.status === 'online';

  const stats: Array<{
    label: string;
    value: string;
    change?: 'up' | 'down';
    icon: typeof Target;
    color: 'profit' | 'loss' | 'muted';
  }> = [
    {
      label: 'Win Rate',
      value: summary.winRate ? `${summary.winRate.toFixed(1)}%` : '0.0%',
      change: (summary.winRate || 0) >= 50 ? 'up' : 'down',
      icon: Target,
      color: (summary.winRate || 0) >= 50 ? 'profit' : 'loss',
    },
    {
      label: 'Profit Factor',
      value: summary.profitFactor ? summary.profitFactor.toFixed(2) : '0.00',
      change: (summary.profitFactor || 0) >= 1.5 ? 'up' : 'down',
      icon: BarChart3,
      color: (summary.profitFactor || 0) >= 1.5 ? 'profit' : 'loss',
    },
    {
      label: 'Total Trades',
      value: (summary.totalTrades || 0).toString(),
      icon: Activity,
      color: 'muted',
    },
    {
      label: 'System Status',
      value: meridianOnline ? 'Online' : 'Offline',
      icon: RefreshCw,
      color: meridianOnline ? 'profit' : 'loss',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="border-primary/30 hover:border-primary/55">
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div
                  className={`rounded-xl border p-2 ${
                    stat.color === 'profit'
                      ? 'border-profit/30 bg-profit/15'
                      : stat.color === 'loss'
                      ? 'border-loss/30 bg-loss/15'
                      : 'border-primary/35 bg-primary/10'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      stat.color === 'profit'
                        ? 'text-profit'
                        : stat.color === 'loss'
                        ? 'text-loss'
                        : 'text-muted-foreground'
                    }`}
                  />
                </div>
                {stat.change &&
                  (stat.change === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-profit" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-loss" />
                  ))}
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">{stat.label}</p>
                <p
                  className={`text-2xl font-bold ${
                    stat.color === 'profit' ? 'text-profit' : stat.color === 'loss' ? 'text-loss' : 'text-foreground'
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecentActivity() {
  const { data: trades, loading, error } = useTradeData();

  if (loading) {
    return <LoadingCard />;
  }

  if (error || !trades) {
    return <ErrorCard message="Failed to load recent trades" />;
  }

  const recentTrades = (trades.trades as DashboardTrade[]).slice(0, 10);

  return (
    <Card className="col-span-full border-primary/30">
      <CardHeader className="border-b border-primary/20 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Recent Activity</CardTitle>
          <Link href="/trades" className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-primary/15">
          {recentTrades.map((trade, index) => {
            const direction = (trade.direction || 'UNKNOWN').toUpperCase();
            const bullish = isBullishDirection(direction);
            const pnlValue = parseNumber(trade.pnl) ?? parseNumber(trade.profit_loss);
            const isWin = pnlValue !== null && pnlValue >= 0;
            const entryPrice = parseNumber(trade.entry_price);

            return (
              <div
                key={`${trade.symbol || 'trade'}-${index}`}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-primary/[0.06] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                      bullish ? 'border-profit/30 bg-profit/15' : 'border-loss/30 bg-loss/15'
                    }`}
                  >
                    {bullish ? <TrendingUp className="h-5 w-5 text-profit" /> : <TrendingDown className="h-5 w-5 text-loss" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{trade.symbol || 'N/A'}</span>
                      <Badge variant="outline" className={bullish ? 'border-profit/30 text-profit' : 'border-loss/30 text-loss'}>
                        {direction}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {trade.created_at ? formatDate(trade.created_at) : 'Unknown date'}
                      {entryPrice !== null ? ` • Entry: $${entryPrice.toFixed(2)}` : ''}
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className={`text-lg font-bold ${isWin ? 'text-profit' : 'text-loss'}`}>
                    {pnlValue !== null ? (
                      <>
                        {pnlValue >= 0 ? '+' : ''}
                        {formatCurrency(pnlValue)}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{trade.status || 'Unknown'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [userSession, setUserSession] = useState<{ username: string; avatar: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setUserSession({ username: data.user.username, avatar: data.user.avatar });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex items-center gap-4">
          {userSession?.avatar && (
            <img
              src={userSession.avatar}
              alt={userSession.username}
              className="h-12 w-12 rounded-full border-2 border-primary/40"
            />
          )}
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {userSession ? `Welcome back, ${userSession.username}` : 'Nebula System Style'}
            </p>
            <h1 className="text-3xl font-bold tracking-tight nebula-gradient-text">Dashboard</h1>
          </div>
        </header>

        <PortfolioHeader />
        <StatsGrid />
        <RecentActivity />
      </div>
    </div>
  );
}
