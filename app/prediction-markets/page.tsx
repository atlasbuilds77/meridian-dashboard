'use client';

import { useLiveData } from '@/hooks/use-live-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  TrendingDown,
  TrendingUp,
  Zap,
  Clock,
  Target,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OracleResponse {
  status: 'online' | 'stopped' | 'offline' | 'unknown';
  name: string;
  stats: {
    total_trades: number;
    wins: number;
    losses: number;
    pending: number;
    total_profit: number;
    win_rate: number;
  } | null;
  recentTrades: Array<{
    id: number;
    timestamp: string;
    asset: string;
    direction: string;
    cost: number;
    edge: number;
    model_prob: number;
    outcome: string;
    profit: number;
  }>;
}

interface NightWatchResponse {
  status: 'online' | 'stopped' | 'offline' | 'unknown' | 'error';
  name: string;
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
    openPositions: number;
    openPnL: number;
  } | null;
  recentTrades: Array<{
    question: string;
    category: string;
    confidence: string;
    edge_at_entry: number;
    stake_usd: number;
    pnl: number;
    resolved_at: string;
  }>;
  openPositions: Array<{
    question: string;
    direction: string;
    entry_price: number;
    current_price: number;
    pnl: number;
    stake_usd: number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return ts; }
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'online' ? 'bg-profit animate-pulse' : status === 'stopped' ? 'bg-yellow-500' : 'bg-loss';
  return <span className={cn('inline-block h-2 w-2 rounded-full', color)} />;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ oracle, nightwatch }: { oracle: OracleResponse | null; nightwatch: NightWatchResponse | null }) {
  const oraclePnL = oracle?.stats?.total_profit || 0;
  const nwPnL = nightwatch?.stats?.totalPnL || 0;
  const totalPnL = oraclePnL + nwPnL;
  const isPos = totalPnL >= 0;
  const oracleOnline = oracle?.status === 'online';
  const nwOnline = nightwatch?.status === 'online';

  return (
    <section className="hero-section rounded border border-border">
      <div className="relative z-10">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="data-label">Prediction Markets</p>
          <div className="flex items-center gap-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
              <StatusDot status={oracle?.status || 'unknown'} />
              Oracle {oracleOnline ? 'Live' : 'Offline'}
            </span>
            <span className="flex items-center gap-1.5">
              <StatusDot status={nightwatch?.status || 'unknown'} />
              NightWatch {nwOnline ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h1 className={`font-mono text-3xl font-bold tabular-nums sm:text-4xl ${isPos ? 'text-profit' : 'text-loss'}`}>
            {isPos ? '+' : ''}${Math.abs(totalPnL).toFixed(2)}
          </h1>
          <span className="text-xs text-muted-foreground">combined P&L (paper)</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="stat-box rounded">
            <p className="stat-box-label">Oracle P&L</p>
            <p className={`stat-box-value ${oraclePnL >= 0 ? 'text-profit' : 'text-loss'}`}>${oraclePnL.toFixed(2)}</p>
          </div>
          <div className="stat-box rounded">
            <p className="stat-box-label">Oracle WR</p>
            <p className={`stat-box-value ${(oracle?.stats?.win_rate || 0) >= 50 ? 'text-profit' : 'text-loss'}`}>{oracle?.stats?.win_rate || 0}%</p>
          </div>
          <div className="stat-box rounded">
            <p className="stat-box-label">NightWatch P&L</p>
            <p className={`stat-box-value ${nwPnL >= 0 ? 'text-profit' : 'text-loss'}`}>${nwPnL.toFixed(2)}</p>
          </div>
          <div className="stat-box rounded">
            <p className="stat-box-label">NightWatch WR</p>
            <p className={`stat-box-value ${(nightwatch?.stats?.winRate || 0) >= 50 ? 'text-profit' : 'text-loss'}`}>{nightwatch?.stats?.winRate || 0}%</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Oracle Signal Feed ───────────────────────────────────────────────────────

function OracleFeed({ trades, loading }: { trades: OracleResponse['recentTrades']; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-amber-500" />
          Oracle Signals
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px]">BTC · ETH · SOL</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-px">
            {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse bg-muted/20 border-b border-border" />)}
          </div>
        ) : trades.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <Activity className="mx-auto h-5 w-5 mb-2 opacity-40" />
            No signals yet — Oracle scans every 15 min
          </div>
        ) : (
          <div className="divide-y divide-border">
            {trades.map((t, i) => {
              const isUp = t.direction === 'UP';
              const isWin = t.outcome === 'win';
              const isPending = !t.outcome || t.outcome === 'pending';
              return (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/40">
                  <div className="flex items-center gap-2.5">
                    {isUp
                      ? <ArrowUpRight className="h-3.5 w-3.5 text-profit shrink-0" />
                      : <ArrowDownRight className="h-3.5 w-3.5 text-loss shrink-0" />}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold uppercase">{t.asset}</span>
                        <Badge variant="outline" className={`text-[9px] ${isUp ? 'border-profit/30 text-profit' : 'border-loss/30 text-loss'}`}>
                          {t.direction}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">edge {(t.edge * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{fmtTime(t.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isPending ? (
                      <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-500">OPEN</Badge>
                    ) : (
                      <span className={`font-mono text-xs font-semibold ${isWin ? 'text-profit' : 'text-loss'}`}>
                        {isWin ? '+' : ''}${t.profit?.toFixed(2)}
                      </span>
                    )}
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

// ─── NightWatch Signal Feed ───────────────────────────────────────────────────

function NightWatchFeed({
  trades, positions, loading
}: {
  trades: NightWatchResponse['recentTrades'];
  positions: NightWatchResponse['openPositions'];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-blue-400" />
          NightWatch Signals
          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[9px]">MACRO · CORPORATE · TECH</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-px">
            {[1,2,3].map(i => <div key={i} className="h-14 animate-pulse bg-muted/20 border-b border-border" />)}
          </div>
        ) : (
          <>
            {/* Open positions */}
            {positions.length > 0 && (
              <div className="border-b border-border">
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Open ({positions.length})</p>
                {positions.map((p, i) => {
                  const isPos = (p.pnl || 0) >= 0;
                  return (
                    <div key={i} className="flex items-start justify-between px-4 py-2 hover:bg-secondary/40 border-t border-border/50">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-xs text-foreground truncate">{p.question}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className={`text-[9px] ${p.direction === 'YES' || p.direction === 'UP' ? 'border-profit/30 text-profit' : 'border-loss/30 text-loss'}`}>
                            {p.direction}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">@${p.entry_price?.toFixed(2)}</span>
                        </div>
                      </div>
                      <span className={`font-mono text-xs font-semibold shrink-0 ${isPos ? 'text-profit' : 'text-loss'}`}>
                        {isPos ? '+' : ''}${(p.pnl || 0).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resolved trades */}
            {trades.length === 0 && positions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Activity className="mx-auto h-5 w-5 mb-2 opacity-40" />
                No signals yet — NightWatch scans every hour
              </div>
            ) : (
              <>
                {trades.length > 0 && (
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Resolved</p>
                )}
                <div className="divide-y divide-border">
                  {trades.map((t, i) => {
                    const isWin = (t.pnl || 0) > 0;
                    return (
                      <div key={i} className="flex items-start justify-between px-4 py-2.5 hover:bg-secondary/40">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="text-xs text-foreground truncate">{t.question}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{t.category}</Badge>
                            <Badge variant="outline" className={`text-[9px] ${t.confidence === 'MEDIUM' || t.confidence === 'HIGH' ? 'border-profit/30 text-profit' : 'border-border text-muted-foreground'}`}>
                              {t.confidence}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">edge {((t.edge_at_entry || 0) * 100).toFixed(0)}%</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(t.resolved_at)}</p>
                        </div>
                        <span className={`font-mono text-xs font-semibold shrink-0 ${isWin ? 'text-profit' : 'text-loss'}`}>
                          {isWin ? '+' : ''}${(t.pnl || 0).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Bot Status Cards ─────────────────────────────────────────────────────────

function BotCard({
  name, status, stats, variant
}: {
  name: string;
  status: string;
  stats: OracleResponse['stats'] | NightWatchResponse['stats'] | null;
  variant: 'oracle' | 'nightwatch';
}) {
  const isOracle = variant === 'oracle';
  const color = isOracle ? 'text-amber-400' : 'text-blue-400';
  const borderColor = isOracle ? 'border-amber-500/20' : 'border-blue-500/20';

  const trades = isOracle ? (stats as OracleResponse['stats'])?.total_trades : (stats as NightWatchResponse['stats'])?.totalTrades;
  const wr = isOracle ? (stats as OracleResponse['stats'])?.win_rate : (stats as NightWatchResponse['stats'])?.winRate;
  const pnl = isOracle ? (stats as OracleResponse['stats'])?.total_profit : (stats as NightWatchResponse['stats'])?.totalPnL;
  const wrGood = (wr || 0) >= 50;
  const pnlPos = (pnl || 0) >= 0;

  return (
    <Card className={cn('border', borderColor)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isOracle ? <Zap className={cn('h-4 w-4', color)} /> : <Eye className={cn('h-4 w-4', color)} />}
            <span className="font-semibold text-sm">{name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot status={status} />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {status === 'online' ? 'Live' : status}
            </span>
            <Badge variant="outline" className="text-[9px] ml-1">PAPER</Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="stat-box rounded text-center">
            <p className="stat-box-label">Trades</p>
            <p className="stat-box-value">{trades || 0}</p>
          </div>
          <div className="stat-box rounded text-center">
            <p className="stat-box-label">Win Rate</p>
            <p className={`stat-box-value ${wrGood ? 'text-profit' : 'text-loss'}`}>{wr || 0}%</p>
          </div>
          <div className="stat-box rounded text-center">
            <p className="stat-box-label">P&L</p>
            <p className={`stat-box-value ${pnlPos ? 'text-profit' : 'text-loss'}`}>
              {pnlPos ? '+' : ''}${(pnl || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PredictionMarketsPage() {
  const { data: oracle, loading: oracleLoading } = useLiveData<OracleResponse>('/api/prediction-markets/oracle', 30_000);
  const { data: nightwatch, loading: nightwatchLoading } = useLiveData<NightWatchResponse>('/api/prediction-markets/nightwatch', 30_000);

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-4">

        {/* Header */}
        <header>
          <p className="data-label">24/7 AI Signal Bots</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Prediction Markets</h1>
        </header>

        {/* Combined P&L */}
        <Header oracle={oracle} nightwatch={nightwatch} />

        {/* Bot status */}
        <div className="grid gap-4 sm:grid-cols-2">
          <BotCard
            name="Oracle"
            status={oracle?.status || 'unknown'}
            stats={oracle?.stats || null}
            variant="oracle"
          />
          <BotCard
            name="NightWatch"
            status={nightwatch?.status || 'unknown'}
            stats={nightwatch?.stats || null}
            variant="nightwatch"
          />
        </div>

        {/* Signal feeds */}
        <div className="grid gap-4 lg:grid-cols-2">
          <OracleFeed
            trades={oracle?.recentTrades || []}
            loading={oracleLoading && !oracle}
          />
          <NightWatchFeed
            trades={nightwatch?.recentTrades || []}
            positions={nightwatch?.openPositions || []}
            loading={nightwatchLoading && !nightwatch}
          />
        </div>

        {/* Coming soon notice */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Kalshi Integration Coming Soon</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Once Oracle &amp; NightWatch hit consistent 60%+ win rates, we&apos;ll wire up auto-trading via Kalshi — 
                  fully US-legal, no VPN, no wallet bans. Signal-only for now.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
