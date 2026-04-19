'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Share2,
  Lock,
} from 'lucide-react';
import { useTradeData, useMarketData, useAccountData, useSystemStatus, useLiveData } from '@/hooks/use-live-data';
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils-client';
import { ShareCardModal } from '@/components/share-card-modal';
import { PnLShareButton } from '@/components/pnl-share-button';
import { AnimatedCounter } from '@/components/animated-counter';
import { Sparkline } from '@/components/sparkline';
import { TodayPnLCard } from '@/components/today-pnl-card';
import { 
  PortfolioHeaderSkeleton, 
  StatsCardSkeleton, 
  TableRowSkeleton 
} from '@/components/skeletons';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { Zap } from 'lucide-react';
// NDA handled by NDAProvider in layout.tsx

// ─── Helios types ────────────────────────────────────────────────────────────
interface HeliosAccessResponse { hasAccess: boolean; }
interface HeliosSummary {
  total_trades?: number;
  wins?: number;
  losses?: number;
  total_pnl?: number;
  win_rate?: number;
}
interface HeliosWeeklyData {
  trades?: Array<{ symbol: string; direction: string; pnl?: number; opened_at?: string; status?: string; }>;
  weekly_trades?: Array<{ symbol: string; direction: string; pnl?: number; opened_at?: string; status?: string; }>;
  summary?: HeliosSummary;
  stats?: HeliosSummary;
}

function useHeliosAccess() {
  return useLiveData<HeliosAccessResponse>('/api/helios/access', 300_000);
}
function usePredictionAccess() {
  return useLiveData<HeliosAccessResponse>('/api/singularity/access', 300_000);
}
function useHeliosWeekly() {
  return useLiveData<HeliosWeeklyData>('/api/helios/weekly', 60_000);
}

function HeliosDashboardCard() {
  const { data: weekly, loading } = useHeliosWeekly();
  const summary = weekly?.summary ?? weekly?.stats;
  const trades = weekly?.trades ?? weekly?.weekly_trades ?? [];
  const totalPnL = summary?.total_pnl ?? 0;
  const winRate  = summary?.win_rate  ?? 0;
  const isPos    = totalPnL >= 0;

  return (
    <Card className="border-orange-500/20">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-orange-500" />
            Helios Signals
          </CardTitle>
          <Link href="/helios" className="text-[10px] font-medium uppercase tracking-wide text-orange-400 hover:text-orange-300">View all →</Link>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-4 bg-muted/30 rounded animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">P&L</p>
                <p className={`font-mono text-base font-bold tabular-nums ${isPos ? 'text-profit' : 'text-loss'}`}>
                  {isPos ? '+' : ''}{formatCurrency(totalPnL)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Win Rate</p>
                <p className={`font-mono text-base font-bold tabular-nums ${winRate >= 50 ? 'text-profit' : 'text-loss'}`}>
                  {winRate > 0 ? `${winRate.toFixed(0)}%` : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Trades</p>
                <p className="font-mono text-base font-bold tabular-nums text-foreground">
                  {summary?.total_trades ?? 0}
                </p>
              </div>
            </div>
            {trades.slice(0, 4).map((t, i) => {
              const pnl = t.pnl ?? 0;
              const bull = ['LONG','CALL','BUY'].includes((t.direction||'').toUpperCase());
              return (
                <div key={i} className="flex items-center justify-between py-1.5 border-t border-border/50 text-xs">
                  <div className="flex items-center gap-2">
                    {bull
                      ? <ArrowUpRight className="h-3 w-3 text-profit" />
                      : <ArrowDownRight className="h-3 w-3 text-loss" />}
                    <span className="font-mono font-semibold">{t.symbol}</span>
                    <Badge variant="outline" className={`text-[9px] ${bull ? 'border-profit/30 text-profit' : 'border-loss/30 text-loss'}`}>{(t.direction||'').toUpperCase()}</Badge>
                  </div>
                  <span className={`font-mono font-semibold tabular-nums ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                  </span>
                </div>
              );
            })}
            {trades.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">No signals this week</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface TradierPnLData {
  totalPnL: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  dailyPnL: Array<{ date: string; dailyPnL: number; cumulativePnL: number }>;
  timestamp: string;
}

function useTradierPnL() {
  return useLiveData<TradierPnLData>('/api/user/tradier-pnl', 60_000);
}

type DashboardTrade = {
  symbol?: string;
  direction?: string;
  status?: string;
  created_at?: string;
  entry_date?: string;
  entry_price?: number | string | null;
  pnl?: number | string | null;
  profit_loss?: number | string | null;
};

type OracleFeedResponse = {
  recentTrades?: Array<{
    id?: number | string;
    timestamp?: string;
    asset?: string;
    direction?: string;
    outcome?: string;
    profit?: number | null;
  }>;
};

type NightWatchFeedResponse = {
  recentTrades?: Array<{
    question?: string;
    direction?: string;
    outcome?: string;
    pnl?: number | null;
    timestamp?: string;
    resolved_at?: string;
  }>;
};

type ZeusFeedResponse = {
  recentTrades?: Array<{
    id?: number | string;
    timestamp?: string;
    asset?: string;
    direction?: string;
    outcome?: string;
    pnl_usd?: number | null;
  }>;
};

type KronosFeedResponse = {
  recentFills?: Array<{
    id?: number | string;
    timestamp?: string;
    asset?: string;
    grid_profit?: number | null;
  }>;
};

type UnifiedActivityItem = {
  key: string;
  system: 'Meridian' | 'Helios' | 'Oracle' | 'NightWatch' | 'Zeus' | 'Kronos';
  symbol: string;
  direction: string;
  status: string;
  pnl: number | null;
  timestamp: string;
};

function parseNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function isBullishDirection(direction: string): boolean {
  return ['LONG', 'CALL', 'BUY', 'BULL'].includes(direction.toUpperCase());
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
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
    <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide">
      <div className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-profit animate-pulse' : 'bg-muted-foreground'}`} />
      <span className={isLive ? 'text-profit' : 'text-muted-foreground'}>
        {isLive ? 'Live' : `${secondsAgo}s`}
      </span>
    </div>
  );
}



function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-loss/30">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-loss">
          <AlertCircle className="h-4 w-4" />
          <p className="text-xs font-medium">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioHeader() {
  const { data: trades, loading: tradesLoading, error: tradesError } = useTradeData();
  const { data: accounts, loading: accountsLoading } = useAccountData();
  const { data: market, lastUpdate } = useMarketData('QQQ');
  const { data: tradierPnL } = useTradierPnL();

  if (tradesLoading || accountsLoading) {
    return <PortfolioHeaderSkeleton />;
  }

  if (tradesError || !trades) {
    return <ErrorCard message="Failed to load portfolio data" />;
  }

  // Use Tradier P&L as source of truth when available, fall back to DB trades
  const totalPnL = tradierPnL?.totalPnL ?? trades.summary.totalPnL ?? 0;
  const accountBalance = accounts?.totalBalance || 0;
  // Portfolio value = current balance (already includes today's P/L)
  // Don't add totalPnL again - that would double-count!
  const totalValue = accountBalance;
  const totalReturn = accountBalance > 0 ? (totalPnL / accountBalance) * 100 : 0;
  const isPositive = totalPnL >= 0;
  const shareText = `ZeroG P&L update: ${formatCurrency(totalPnL)} on ${formatCurrency(totalValue)} portfolio value (${formatPercent(totalReturn)}).`;

  // Extract sparkline data from Tradier daily P&L (cumulative, last 14 days)
  const sparklineData = tradierPnL?.dailyPnL
    ? tradierPnL.dailyPnL.slice(-14).map((d) => d.cumulativePnL)
    : [];

  return (
    <section className="hero-section rounded border border-border">
      <div className="relative z-10">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="data-label">Portfolio Value</p>
          <div className="flex flex-wrap items-center gap-3">
            <LiveIndicator lastUpdate={lastUpdate} />
            <PnLShareButton title="ZeroG P&L" text={shareText} />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h1 className={`font-mono text-3xl font-bold tabular-nums sm:text-5xl ${isPositive ? 'text-profit' : 'text-loss'}`}>
            <AnimatedCounter
              value={totalValue}
              duration={1000}
              formatFn={formatCurrency}
            />
          </h1>

          <div className="inline-flex items-center gap-1">
            {isPositive ? <ArrowUpRight className="h-4 w-4 text-profit" /> : <ArrowDownRight className="h-4 w-4 text-loss" />}
            <span className={`font-mono text-base font-semibold tabular-nums sm:text-xl ${isPositive ? 'text-profit' : 'text-loss'}`}>
              {formatPercent(totalReturn)}
            </span>
          </div>

          {sparklineData.length >= 2 && (
            <Sparkline
              data={sparklineData}
              width={100}
              height={32}
              className="hidden sm:block"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="stat-box rounded">
            <span className="stat-box-label">P&L</span>
            <span className={`stat-box-value ${isPositive ? 'text-profit' : 'text-loss'}`}>
              <AnimatedCounter
                value={totalPnL}
                duration={1000}
                formatFn={formatCurrency}
              />
            </span>
          </div>

          {market && (
            <div className="stat-box rounded">
              <span className="stat-box-label">QQQ</span>
              <span className="stat-box-value">
                ${market.price.toFixed(2)}{' '}
                <span className={`text-sm ${market.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {market.change >= 0 ? '+' : ''}{market.changePercent.toFixed(2)}%
                </span>
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
          <StatsCardSkeleton key={item} />
        ))}
      </div>
    );
  }

  if (error || !trades) {
    return <ErrorCard message="Failed to load statistics" />;
  }

  const summary = trades.summary;
  const meridianStatus = status?.systems.meridian.status ?? 'offline';
  const meridianStatusLabel =
    meridianStatus === 'online' ? 'Online' : meridianStatus === 'degraded' ? 'Degraded' : 'Offline';
  const meridianStatusColor: 'profit' | 'loss' | 'muted' =
    meridianStatus === 'online' ? 'profit' : meridianStatus === 'degraded' ? 'muted' : 'loss';

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
      value: meridianStatusLabel,
      icon: RefreshCw,
      color: meridianStatusColor,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:border-border/80">
            <CardContent className="p-3">
              <div className="mb-2 flex items-start justify-between">
                <Icon
                  className={`h-3.5 w-3.5 ${
                    stat.color === 'profit'
                      ? 'text-profit'
                      : stat.color === 'loss'
                      ? 'text-loss'
                      : 'text-muted-foreground'
                  }`}
                />
                {stat.change &&
                  (stat.change === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-profit" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-loss" />
                  ))}
              </div>
              <div>
                <p className="data-label mb-0.5">{stat.label}</p>
                <p
                  className={`font-mono text-lg font-semibold tabular-nums ${
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

function UnifiedActivityHub() {
  const { data: meridian, loading: meridianLoading } = useTradeData();
  const { data: heliosAccess, loading: heliosAccessLoading } = useHeliosAccess();
  const { data: predictionAccess, loading: predictionAccessLoading } = usePredictionAccess();
  const { data: heliosWeekly, loading: heliosLoading } = useHeliosWeekly();

  const { data: oracle, loading: oracleLoading } = useLiveData<OracleFeedResponse>('/api/prediction-markets/oracle', 30_000);
  const { data: nightwatch, loading: nightwatchLoading } = useLiveData<NightWatchFeedResponse>('/api/prediction-markets/nightwatch', 30_000);
  const { data: zeus, loading: zeusLoading } = useLiveData<ZeusFeedResponse>('/api/prediction-markets/zeus', 30_000);
  const { data: kronos, loading: kronosLoading } = useLiveData<KronosFeedResponse>('/api/prediction-markets/kronos', 30_000);

  const items = useMemo(() => {
    const merged: UnifiedActivityItem[] = [];

    const meridianTrades = (meridian?.trades ?? []) as DashboardTrade[];
    meridianTrades.forEach((trade, index) => {
      const timestamp = trade.created_at || trade.entry_date;
      if (!timestamp) return;

      merged.push({
        key: `meridian-${index}-${timestamp}`,
        system: 'Meridian',
        symbol: trade.symbol || 'N/A',
        direction: (trade.direction || 'UNKNOWN').toUpperCase(),
        status: (trade.status || 'open').toUpperCase(),
        pnl: parseNumber(trade.pnl) ?? parseNumber(trade.profit_loss),
        timestamp,
      });
    });

    if (heliosAccess?.hasAccess) {
      const heliosTrades = heliosWeekly?.trades ?? heliosWeekly?.weekly_trades ?? [];
      heliosTrades.forEach((trade, index) => {
        const timestamp = trade.opened_at;
        if (!timestamp) return;

        merged.push({
          key: `helios-${index}-${timestamp}`,
          system: 'Helios',
          symbol: trade.symbol || 'N/A',
          direction: (trade.direction || 'UNKNOWN').toUpperCase(),
          status: (trade.status || 'open').toUpperCase(),
          pnl: parseNumber(trade.pnl),
          timestamp,
        });
      });
    }

    if (predictionAccess?.hasAccess) {
      (oracle?.recentTrades ?? []).forEach((trade, index) => {
        if (!trade.timestamp) return;
        merged.push({
          key: `oracle-${trade.id ?? index}-${trade.timestamp}`,
          system: 'Oracle',
          symbol: trade.asset || 'Market',
          direction: (trade.direction || 'UNKNOWN').toUpperCase(),
          status: (trade.outcome || 'open').toUpperCase(),
          pnl: parseNumber(trade.profit),
          timestamp: trade.timestamp,
        });
      });

      (nightwatch?.recentTrades ?? []).forEach((trade, index) => {
        const timestamp = trade.timestamp || trade.resolved_at;
        if (!timestamp) return;
        const label = (trade.question || 'Prediction Market Trade').slice(0, 56);

        merged.push({
          key: `nightwatch-${index}-${timestamp}`,
          system: 'NightWatch',
          symbol: label,
          direction: (trade.direction || 'POSITION').toUpperCase(),
          status: (trade.outcome || 'open').toUpperCase(),
          pnl: parseNumber(trade.pnl),
          timestamp,
        });
      });

      (zeus?.recentTrades ?? []).forEach((trade, index) => {
        if (!trade.timestamp) return;
        merged.push({
          key: `zeus-${trade.id ?? index}-${trade.timestamp}`,
          system: 'Zeus',
          symbol: trade.asset || 'BTC',
          direction: (trade.direction || 'UNKNOWN').toUpperCase(),
          status: (trade.outcome || 'open').toUpperCase(),
          pnl: parseNumber(trade.pnl_usd),
          timestamp: trade.timestamp,
        });
      });

      (kronos?.recentFills ?? []).forEach((fill, index) => {
        if (!fill.timestamp) return;
        merged.push({
          key: `kronos-${fill.id ?? index}-${fill.timestamp}`,
          system: 'Kronos',
          symbol: `${fill.asset || 'BTC'} GRID`,
          direction: 'GRID',
          status: 'FILLED',
          pnl: parseNumber(fill.grid_profit),
          timestamp: fill.timestamp,
        });
      });
    }

    return merged
      .sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp))
      .slice(0, 24);
  }, [meridian, heliosAccess?.hasAccess, heliosWeekly, predictionAccess?.hasAccess, oracle, nightwatch, zeus, kronos]);

  const loading =
    meridianLoading ||
    heliosAccessLoading ||
    predictionAccessLoading ||
    (heliosAccess?.hasAccess ? heliosLoading : false) ||
    (predictionAccess?.hasAccess ? oracleLoading || nightwatchLoading || zeusLoading || kronosLoading : false);

  if (loading && items.length === 0) {
    return (
      <Card className="col-span-full border-primary/30">
        <CardHeader className="border-b border-primary/20 pb-4">
          <div className="animate-pulse h-6 w-44 bg-muted/30 rounded" />
        </CardHeader>
        <CardContent className="p-0">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <TableRowSkeleton key={item} />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="border-b border-border pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Trades & Systems Activity</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Unified feed across Meridian, Helios, and prediction systems.</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-wide">
            <Link href="/trades" className="text-primary hover:text-primary/80">Meridian</Link>
            {heliosAccess?.hasAccess && (
              <Link href="/helios" className="text-orange-400 hover:text-orange-300">Helios</Link>
            )}
            {predictionAccess?.hasAccess && (
              <Link href="/prediction-markets" className="text-primary hover:text-primary/80">Prediction Bots</Link>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No trade activity available yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const bullish = isBullishDirection(item.direction);
              const hasPnl = item.pnl !== null;
              const pnlPositive = (item.pnl ?? 0) >= 0;

              return (
                <div key={item.key} className="flex flex-col gap-2 px-4 py-2.5 hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${bullish ? 'bg-profit/10' : 'bg-loss/10'}`}>
                      {bullish ? <TrendingUp className="h-3.5 w-3.5 text-profit" /> : <TrendingDown className="h-3.5 w-3.5 text-loss" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{item.system}</Badge>
                        <span className="truncate font-mono text-sm font-semibold text-foreground">{item.symbol}</span>
                        <Badge variant="outline" className={bullish ? 'border-profit/30 text-profit' : 'border-loss/30 text-loss'}>
                          {item.direction}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {formatDate(item.timestamp)} · {item.status}
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className={`font-mono text-sm font-semibold tabular-nums ${hasPnl ? (pnlPositive ? 'text-profit' : 'text-loss') : 'text-muted-foreground'}`}>
                      {hasPnl ? `${pnlPositive ? '+' : ''}${formatCurrency(item.pnl ?? 0)}` : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Only renders if user has Helios role
function HeliosConditionalCard() {
  const { data: access, loading } = useHeliosAccess();
  if (loading || !access?.hasAccess) return null;
  return <HeliosDashboardCard />;
}

function SystemAccessCard() {
  const { data: heliosAccess, loading: heliosLoading } = useHeliosAccess();
  const { data: predictionAccess, loading: predictionLoading } = usePredictionAccess();

  if (heliosLoading || predictionLoading) {
    return (
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <div className="animate-pulse h-5 w-32 bg-muted/30 rounded" />
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse h-8 bg-muted/20 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const systems = [
    { name: 'Meridian', status: 'Active', href: '/trades', gated: false },
    { name: 'Helios', status: heliosAccess?.hasAccess ? 'Active' : 'Locked', href: '/helios', gated: true },
    { name: 'Prediction Bots', status: predictionAccess?.hasAccess ? 'Active' : 'Locked', href: '/prediction-markets', gated: true },
    { name: 'Nebula', status: 'Planned', href: '#', gated: true },
  ] as const;

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm">System Access</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {systems.map((system) => {
            const isActive = system.status === 'Active';
            const isPlanned = system.status === 'Planned';

            return (
              <div key={system.name} className="flex items-center justify-between px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{system.name}</span>
                  {system.gated && !isActive && !isPlanned && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      isActive
                        ? 'border-profit/30 text-profit'
                        : isPlanned
                        ? 'border-muted text-muted-foreground'
                        : 'border-yellow-500/30 text-yellow-500'
                    }
                  >
                    {system.status}
                  </Badge>
                  {system.href !== '#' && (
                    <Link href={system.href} className="text-primary hover:text-primary/80">
                      Open
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function BillingCard() {
  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm">Billing</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Manage your plan, active subscriptions, and payment methods.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/billing">Open Billing</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [userSession, setUserSession] = useState<{ username: string; avatar: string | null; discordId: string | null; userId: string | null } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // NDA state managed by NDAProvider in layout.tsx

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
          
          setUserSession({ 
            username: data.user.username, 
            avatar: fullAvatarUrl,
            discordId: discordId,
            userId: data.user.id 
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleRefresh = async () => {
    // Trigger data refetch by updating key
    setRefreshKey((prev) => prev + 1);
    // Wait a bit to show the refresh animation
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {userSession?.avatar && (
              <Image
                src={userSession.avatar}
                alt={userSession.username}
                width={36}
                height={36}
                className="h-9 w-9 rounded border border-border"
                priority
              />
            )}
            <div>
              <p className="data-label">
                {userSession ? userSession.username : 'ZeroG'}
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            </div>
          </div>

          {/* Share P&L Button */}
          <Button
            onClick={() => setShareModalOpen(true)}
            size="sm"
            variant="outline"
            className="flex items-center gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </header>

        <TodayPnLCard />
        <PortfolioHeader />
        <StatsGrid />
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SystemAccessCard />
          <BillingCard />
        </section>
        {/* Show Helios card on dashboard if user has access */}
        <HeliosConditionalCard />
        <UnifiedActivityHub />

        {/* Share Card Modal */}
        <ShareCardModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          userId={userSession?.userId || undefined}
        />
      </div>
    </div>
    </PullToRefresh>
  );
}
