'use client';

import { useLiveData } from '@/hooks/use-live-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Radio,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface HeliosPosition {
  symbol: string;
  direction: string;
  quantity: number;
  entry_price: number;
  current_price?: number;
  pnl?: number;
  pnl_percent?: number;
  status?: string;
  opened_at?: string;
  strike?: number;
  expiry?: string;
  asset_type?: string;
}

interface HeliosPositionsResponse {
  positions?: HeliosPosition[];
  open_positions?: HeliosPosition[];
  error?: string;
}

interface HeliosWeeklyTrade {
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price?: number;
  pnl?: number;
  pnl_percent?: number;
  quantity?: number;
  opened_at?: string;
  closed_at?: string;
  status?: string;
  strike?: number;
  expiry?: string;
  asset_type?: string;
}

interface HeliosWeeklyResponse {
  trades?: HeliosWeeklyTrade[];
  weekly_trades?: HeliosWeeklyTrade[];
  summary?: {
    total_trades?: number;
    wins?: number;
    losses?: number;
    total_pnl?: number;
    win_rate?: number;
    avg_win?: number;
    avg_loss?: number;
    profit_factor?: number;
  };
  stats?: {
    total_trades?: number;
    wins?: number;
    losses?: number;
    total_pnl?: number;
    win_rate?: number;
  };
  error?: string;
}

interface HeliosAccessResponse {
  hasAccess: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  const formatted = Math.abs(v).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return v < 0 ? `-${formatted}` : formatted;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isBullish(direction: string): boolean {
  const d = direction.toUpperCase();
  return d === 'LONG' || d === 'CALL' || d === 'BULL' || d === 'BUY';
}

// ─── Skeleton ────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center transition-all duration-200 hover:border-primary/40 hover:bg-primary/10">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</p>
    </div>
  );
}

// ─── Access Denied ───────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md border-loss/30">
        <CardContent className="p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-loss" />
          <h2 className="mt-4 text-xl font-bold">Access Restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You need the Helios role in Discord to access signals.
            Contact an admin if you believe this is an error.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Open Positions ──────────────────────────────────────────────────

function OpenPositions({ positions, loading }: { positions: HeliosPosition[]; loading: boolean }) {
  const hasPositions = positions.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Open Positions
          {hasPositions && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
              {positions.length} ACTIVE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => <SkeletonRow key={i} cols={6} />)}
            </TableBody>
          </Table>
        ) : !hasPositions ? (
          <div className="py-12 text-center">
            <Activity className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No open positions</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Helios is watching the market…</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((pos, idx) => {
                const pnl = pos.pnl ?? 0;
                const isProfit = pnl >= 0;
                const bull = isBullish(pos.direction);

                return (
                  <TableRow key={`${pos.symbol}-${idx}`}>
                    <TableCell className="font-mono font-semibold">
                      {pos.symbol}
                      {pos.strike && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ${pos.strike}
                        </span>
                      )}
                      {pos.expiry && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {pos.expiry}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          bull
                            ? 'bg-profit/20 text-profit border-profit/30'
                            : 'bg-loss/20 text-loss border-loss/30'
                        }
                      >
                        {bull ? (
                          <ArrowUpRight className="mr-1 h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="mr-1 h-3 w-3" />
                        )}
                        {pos.direction.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {pos.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(pos.entry_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {pos.current_price != null ? fmtCurrency(pos.current_price) : '—'}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                      {isProfit ? '+' : ''}{fmtCurrency(pnl)}
                      {pos.pnl_percent != null && (
                        <span className="ml-1 text-xs opacity-70">
                          ({fmtPct(pos.pnl_percent)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {fmtDate(pos.opened_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Weekly History ──────────────────────────────────────────────────

function WeeklyHistory({ trades, loading }: { trades: HeliosWeeklyTrade[]; loading: boolean }) {
  const hasTrades = trades.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Weekly Trade History
          {hasTrades && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
              {trades.length} TRADES
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">Closed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} cols={6} />)}
            </TableBody>
          </Table>
        ) : !hasTrades ? (
          <div className="py-12 text-center">
            <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No trades this week</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Closed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade, idx) => {
                const pnl = trade.pnl ?? 0;
                const isProfit = pnl >= 0;
                const bull = isBullish(trade.direction);

                return (
                  <TableRow key={`${trade.symbol}-${idx}`}>
                    <TableCell className="font-mono font-semibold">
                      {trade.symbol}
                      {trade.strike && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ${trade.strike}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          bull
                            ? 'bg-profit/20 text-profit border-profit/30'
                            : 'bg-loss/20 text-loss border-loss/30'
                        }
                      >
                        {bull ? (
                          <ArrowUpRight className="mr-1 h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="mr-1 h-3 w-3" />
                        )}
                        {trade.direction.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {trade.quantity ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(trade.entry_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {trade.exit_price != null ? fmtCurrency(trade.exit_price) : '—'}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                      {isProfit ? '+' : ''}{fmtCurrency(pnl)}
                      {trade.pnl_percent != null && (
                        <span className="ml-1 text-xs opacity-70">
                          ({fmtPct(trade.pnl_percent)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          trade.status === 'closed'
                            ? 'border-muted-foreground/30'
                            : trade.status === 'stopped'
                              ? 'border-loss/30 text-loss'
                              : 'border-primary/30 text-primary'
                        }
                      >
                        {(trade.status ?? 'closed').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {fmtDate(trade.closed_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Summary Header ──────────────────────────────────────────────────

function SummaryHeader({
  positions,
  weeklyData,
}: {
  positions: HeliosPosition[];
  weeklyData: HeliosWeeklyResponse | null;
}) {
  const openPnL = positions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  const summary = weeklyData?.summary ?? weeklyData?.stats;
  const weeklyPnL = summary?.total_pnl ?? 0;
  const totalPnL = openPnL + weeklyPnL;
  const isPositive = totalPnL >= 0;

  const totalTrades = summary?.total_trades ?? 0;
  const winRate = summary?.win_rate ?? 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/35 bg-[rgba(19,19,28,0.78)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Helios Signals</p>
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px]">
              LIVE
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-profit animate-pulse" />
              <span>{positions.length} Open Position{positions.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <h1 className={`text-4xl font-bold tracking-tight sm:text-5xl ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {isPositive ? '+' : ''}{fmtCurrency(totalPnL)}
          </h1>
          <span className="mb-1 text-sm text-muted-foreground">combined P&L</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Open P&L" value={`${openPnL >= 0 ? '+' : ''}${fmtCurrency(openPnL)}`} color={openPnL >= 0 ? 'text-profit' : 'text-loss'} />
          <StatBox label="Weekly P&L" value={`${weeklyPnL >= 0 ? '+' : ''}${fmtCurrency(weeklyPnL)}`} color={weeklyPnL >= 0 ? 'text-profit' : 'text-loss'} />
          <StatBox label="Trades" value={String(totalTrades)} />
          <StatBox label="Win Rate" value={winRate > 0 ? fmtPct(winRate).replace('+', '') : '—'} color={winRate >= 50 ? 'text-profit' : winRate > 0 ? 'text-loss' : undefined} />
        </div>
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function HeliosPage() {
  const { data: access, loading: accessLoading } = useLiveData<HeliosAccessResponse>(
    '/api/helios/access',
    300_000, // check access every 5 min
  );
  const { data: positionsData, loading: positionsLoading } = useLiveData<HeliosPositionsResponse>(
    '/api/helios/positions',
    15_000, // refresh positions every 15s
  );
  const { data: weeklyData, loading: weeklyLoading } = useLiveData<HeliosWeeklyResponse>(
    '/api/helios/weekly',
    60_000, // refresh weekly every 60s
  );

  // Access gate
  if (!accessLoading && access && !access.hasAccess) {
    return <AccessDenied />;
  }

  const positions: HeliosPosition[] =
    positionsData?.positions ?? positionsData?.open_positions ?? [];
  const weeklyTrades: HeliosWeeklyTrade[] =
    weeklyData?.trades ?? weeklyData?.weekly_trades ?? [];

  const loading = positionsLoading || weeklyLoading;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Helios Integration</p>
          <h1 className="text-3xl font-bold tracking-tight nebula-gradient-text">Helios</h1>
        </header>

        {/* Summary */}
        <SummaryHeader positions={positions} weeklyData={weeklyData} />

        {/* Beta Notice */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">Helios — Live Feed</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Real-time positions and weekly trade data from Helios. Data refreshes automatically.
                  Copy-trading execution coming soon via SnapTrade integration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Open Positions */}
        <OpenPositions positions={positions} loading={loading && positions.length === 0} />

        {/* Weekly History */}
        <WeeklyHistory trades={weeklyTrades} loading={loading && weeklyTrades.length === 0} />
      </div>
    </div>
  );
}
