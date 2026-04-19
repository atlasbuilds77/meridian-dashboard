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
    id: number | string;
    timestamp: string;
    asset: string;
    direction: string;
    cost: number;
    edge?: number;
    model_prob?: number;
    outcome: string;
    profit: number | null;
    reason?: string;
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
    openPnL?: number;
  } | null;
  recentTrades: Array<{
    question: string;
    category: string;
    series?: string;
    confidence?: string;
    edge_at_entry?: number;
    stake_usd: number;
    pnl: number | null;
    resolved_at?: string;
    timestamp?: string;
    direction?: string;
    reason?: string;
    outcome?: string;
  }>;
  openPositions: Array<{
    question?: string;
    ticker?: string;
    direction: string;
    entry_price: number;
    current_price?: number;
    pnl?: number;
    stake_usd: number;
    opened_at?: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract edge value from reason string like "...edge=0.730" */
function parseEdge(reason?: string, edge?: number): number | null {
  if (typeof edge === 'number' && !isNaN(edge)) return edge;
  if (!reason) return null;
  const m = reason.match(/edge=([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

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

function Header({
  oracle, nightwatch, zeus, kronos
}: {
  oracle: OracleResponse | null;
  nightwatch: NightWatchResponse | null;
  zeus: ZeusResponse | null;
  kronos: KronosResponse | null;
}) {
  const oraclePnL = oracle?.stats?.total_profit || 0;
  const nwPnL = nightwatch?.stats?.totalPnL || 0;
  const zeusClosedPnL = zeus?.stats?.total_pnl || 0;
  const zeusOpenPnL = zeus?.stats?.open_pnl || 0;
  const zeusPnL = zeus?.stats ? zeusClosedPnL + zeusOpenPnL : 0;
  const kronosPnL = kronos?.stats?.total_pnl || 0;
  const totalPnL = oraclePnL + nwPnL + zeusPnL + kronosPnL;
  const isPos = totalPnL >= 0;
  const oracleOnline = oracle?.status === 'online';
  const nwOnline = nightwatch?.status === 'online';
  const zeusOnline = zeus?.status === 'online';
  const kronosOnline = kronos?.status === 'online';

  return (
    <section className="hero-section rounded border border-border">
      <div className="relative z-10">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="data-label">All Bots</p>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span className="flex items-center gap-1.5"><StatusDot status={oracle?.status || 'unknown'} />Oracle</span>
            <span className="flex items-center gap-1.5"><StatusDot status={nightwatch?.status || 'unknown'} />NightWatch</span>
            <span className="flex items-center gap-1.5"><StatusDot status={zeus?.status || 'unknown'} />Zeus</span>
            <span className="flex items-center gap-1.5"><StatusDot status={kronos?.status || 'unknown'} />Kronos</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h1 className={`font-mono text-3xl font-bold tabular-nums sm:text-4xl ${isPos ? 'text-profit' : 'text-loss'}`}>
            {isPos ? '+' : ''}${Math.abs(totalPnL).toFixed(2)}
          </h1>
          <span className="text-xs text-muted-foreground">combined P&L (all bots, paper, includes Zeus live open P&L)</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="stat-box rounded">
            <p className="stat-box-label">NightWatch P&L</p>
            <p className={`stat-box-value ${nwPnL >= 0 ? 'text-profit' : 'text-loss'}`}>{nwPnL >= 0 ? '+' : ''}${nwPnL.toFixed(2)}</p>
          </div>
          <div className="stat-box rounded">
            <p className="stat-box-label">Oracle P&L</p>
            <p className={`stat-box-value ${oraclePnL >= 0 ? 'text-profit' : 'text-loss'}`}>{oraclePnL >= 0 ? '+' : ''}${oraclePnL.toFixed(2)}</p>
          </div>
          <div className="stat-box rounded">
            <p className="stat-box-label">Zeus Live P&L</p>
            <p className={`stat-box-value ${zeusPnL >= 0 ? 'text-profit' : 'text-loss'}`}>{zeusPnL >= 0 ? '+' : ''}${zeusPnL.toFixed(2)}</p>
          </div>
          <div className="stat-box rounded">
            <p className="stat-box-label">Kronos P&L</p>
            <p className={`stat-box-value ${kronosPnL >= 0 ? 'text-profit' : 'text-loss'}`}>{kronosPnL >= 0 ? '+' : ''}${kronosPnL.toFixed(2)}</p>
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
                        {parseEdge(t.reason, t.edge) !== null && (
                          <span className="text-[10px] text-muted-foreground">edge {((parseEdge(t.reason, t.edge) ?? 0) * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{fmtTime(t.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isPending ? (
                      <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-500">OPEN</Badge>
                    ) : (
                      <span className={`font-mono text-xs font-semibold ${isWin ? 'text-profit' : 'text-loss'}`}>
                        {isWin ? '+' : ''}${(t.profit ?? 0).toFixed(2)}
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
                        <p className="text-xs text-foreground truncate">{p.question || p.ticker}</p>
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
                            {parseEdge(t.reason, t.edge_at_entry) !== null && (
                              <span className="text-[10px] text-muted-foreground">edge {((parseEdge(t.reason, t.edge_at_entry) ?? 0) * 100).toFixed(0)}%</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(t.resolved_at || t.timestamp || '')}</p>
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

interface ZeusResponse {
  status: 'online' | 'offline' | 'unknown';
  name: string;
  stats: {
    total_trades: number;
    wins: number;
    losses: number;
    open: number;
    total_pnl: number;
    open_pnl?: number;
    total_with_open_pnl?: number;
    win_rate: number;
  } | null;
  recentTrades: Array<{
    id: number;
    timestamp: string;
    asset: string;
    direction: string;
    entry_price: number;
    exit_price: number | null;
    pnl_usd: number | null;
    pnl_pct: number | null;
    outcome: string;
    exit_reason: string | null;
    paper: boolean;
  }>;
}

interface KronosResponse {
  status: 'online' | 'offline' | 'unknown';
  name: string;
  stats: {
    total_fills: number;
    btc_fills: number;
    eth_fills: number;
    total_pnl: number;
  } | null;
  recentFills: Array<{
    id: number;
    timestamp: string;
    asset: string;
    buy_level: number;
    sell_level: number | null;
    grid_profit: number | null;
    paper: boolean;
  }>;
}

function ZeusFeed({ trades, loading }: { trades: ZeusResponse['recentTrades']; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-yellow-500" />
          Zeus — Swing Trades
          <Badge variant="outline" className="ml-auto text-xs">Kraken 2x</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
        ) : trades.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No trades yet — waiting for 1h/4h confluence signal</div>
        ) : (
          <div className="divide-y divide-border">
            {trades.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className={cn('flex h-6 min-w-[42px] px-2 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  t.outcome === 'win' ? 'bg-profit/15 text-profit' : t.outcome === 'loss' ? 'bg-loss/15 text-loss' : 'bg-muted text-muted-foreground'
                )}>
                  {t.outcome === 'open' ? 'OPEN' : t.outcome === 'win' ? 'WIN' : 'LOSS'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {t.direction?.toUpperCase()} {t.asset} @ ${t.entry_price?.toLocaleString()}
                    {t.exit_reason && <span className="text-muted-foreground ml-1">→ {t.exit_reason}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(t.timestamp).toLocaleString()}</p>
                </div>
                {t.pnl_usd != null && (
                  <span className={cn('text-xs font-semibold shrink-0', t.pnl_usd >= 0 ? 'text-profit' : 'text-loss')}>
                    {t.pnl_usd >= 0 ? '+' : ''}${Number(t.pnl_usd).toFixed(2)}
                  </span>
                )}
                {t.paper && <Badge variant="outline" className="text-xs shrink-0">paper</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KronosFeed({ fills, loading }: { fills: KronosResponse['recentFills']; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-blue-500" />
          Kronos — Grid Fills
          <Badge variant="outline" className="ml-auto text-xs">Kraken ±6%</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
        ) : fills.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No fills yet — grid orders placed, waiting for price bounces</div>
        ) : (
          <div className="divide-y divide-border">
            {fills.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex h-6 min-w-[30px] px-1 shrink-0 items-center justify-center rounded bg-profit/15 text-[10px] font-semibold text-profit">GF</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {f.asset} grid fill: ${f.buy_level?.toLocaleString()} → ${f.sell_level?.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(f.timestamp).toLocaleString()}</p>
                </div>
                {f.grid_profit !== null && (
                  <span className="text-xs font-semibold text-profit shrink-0">+${Number(f.grid_profit).toFixed(4)}</span>
                )}
                {f.paper && <Badge variant="outline" className="text-xs shrink-0">paper</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PredictionMarketsPage() {
  const { data: oracle, loading: oracleLoading } = useLiveData<OracleResponse>('/api/prediction-markets/oracle', 30_000);
  const { data: nightwatch, loading: nightwatchLoading } = useLiveData<NightWatchResponse>('/api/prediction-markets/nightwatch', 30_000);
  const { data: zeus, loading: zeusLoading } = useLiveData<ZeusResponse>('/api/prediction-markets/zeus', 30_000);
  const { data: kronos, loading: kronosLoading } = useLiveData<KronosResponse>('/api/prediction-markets/kronos', 30_000);

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-4">

        {/* Header */}
        <header>
          <p className="data-label">24/7 AI Signal Bots</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Trading Bots</h1>
        </header>

        {/* Combined P&L */}
        <Header oracle={oracle} nightwatch={nightwatch} zeus={zeus} kronos={kronos} />

        {/* ── Kalshi Bots ── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Kalshi — Prediction Markets</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <BotCard name="NightWatch" status={nightwatch?.status || 'unknown'} stats={nightwatch?.stats || null} variant="nightwatch" />
          </div>
        </div>

        {/* ── Kraken Bots ── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Kraken — Crypto Trading</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <BotCard
              name="Zeus"
              status={zeus?.status || 'unknown'}
              stats={zeus?.stats ? {
                total_trades: zeus.stats.total_trades,
                wins: zeus.stats.wins,
                losses: zeus.stats.losses,
                pending: zeus.stats.open,
                total_profit: zeus.stats.total_pnl,
                win_rate: zeus.stats.win_rate,
              } : null}
              variant="oracle"
            />
            <BotCard
              name="Kronos"
              status={kronos?.status || 'unknown'}
              stats={kronos?.stats ? {
                total_trades: kronos.stats.total_fills,
                wins: kronos.stats.total_fills,
                losses: 0,
                pending: 0,
                total_profit: kronos.stats.total_pnl,
                win_rate: kronos.stats.total_fills > 0 ? 100 : 0,
              } : null}
              variant="oracle"
            />
          </div>
        </div>

        {/* ── Signal Feeds ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <NightWatchFeed
            trades={nightwatch?.recentTrades || []}
            positions={nightwatch?.openPositions || []}
            loading={nightwatchLoading && !nightwatch}
          />
          <ZeusFeed trades={zeus?.recentTrades || []} loading={zeusLoading && !zeus} />
        </div>
        <div className="grid gap-4 lg:grid-cols-1">
          <KronosFeed fills={kronos?.recentFills || []} loading={kronosLoading && !kronos} />
        </div>

        {/* Platform info */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">NightWatch — Kalshi</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Macro event prediction: Fed, CPI, Tariffs. US-legal, no wallet. Paper until 60%+ WR.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Zeus + Kronos — Kraken</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Zeus: swing trades (1h/4h TA, 2x leverage). Kronos: grid bot (±6%, auto-rebalance). 24/7 including weekends.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
