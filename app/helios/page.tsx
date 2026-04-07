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
    <div className="stat-box rounded text-center">
      <p className="stat-box-label">{label}</p>
      <p className={`stat-box-value ${color ?? 'text-foreground'}`}>{value}</p>
    </div>
  );
}

// ─── Access Denied ───────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-sm border-loss/30">
        <CardContent className="p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-loss" />
          <h2 className="mt-3 text-sm font-semibold uppercase tracking-wide">Access Restricted</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Helios role required. Contact admin if needed.
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
          <Radio className="h-4 w-4 text-primary" />
          Open Positions
          {hasPositions && (
            <Badge>
              {positions.length} Active
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
                <TableHead>Dir</TableHead>
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
          <div className="py-8 text-center">
            <Activity className="mx-auto h-6 w-6 text-muted-foreground/40" />
            <p className="mt-2 text-xs text-muted-foreground">No open positions</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Dir</TableHead>
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
                    <TableCell className="font-semibold">
                      {pos.symbol}
                      {pos.strike && (
                        <span className="ml-1 text-muted-foreground">
                          ${pos.strike}
                        </span>
                      )}
                      {pos.expiry && (
                        <span className="ml-1 text-muted-foreground">
                          {pos.expiry}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          bull
                            ? 'border-profit/30 text-profit'
                            : 'border-loss/30 text-loss'
                        }
                      >
                        {bull ? (
                          <ArrowUpRight className="h-2.5 w-2.5" />
                        ) : (
                          <ArrowDownRight className="h-2.5 w-2.5" />
                        )}
                        {pos.direction.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {pos.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtCurrency(pos.entry_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {pos.current_price != null ? fmtCurrency(pos.current_price) : '—'}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                      {isProfit ? '+' : ''}{fmtCurrency(pnl)}
                      {pos.pnl_percent != null && (
                        <span className="ml-1 opacity-70">
                          ({fmtPct(pos.pnl_percent)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
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
          <TrendingUp className="h-4 w-4 text-primary" />
          Weekly History
          {hasTrades && (
            <Badge>
              {trades.length} Trades
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
                <TableHead>Dir</TableHead>
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
          <div className="py-8 text-center">
            <TrendingUp className="mx-auto h-6 w-6 text-muted-foreground/40" />
            <p className="mt-2 text-xs text-muted-foreground">No trades this week</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Dir</TableHead>
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
                    <TableCell className="font-semibold">
                      {trade.symbol}
                      {trade.strike && (
                        <span className="ml-1 text-muted-foreground">
                          ${trade.strike}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          bull
                            ? 'border-profit/30 text-profit'
                            : 'border-loss/30 text-loss'
                        }
                      >
                        {bull ? (
                          <ArrowUpRight className="h-2.5 w-2.5" />
                        ) : (
                          <ArrowDownRight className="h-2.5 w-2.5" />
                        )}
                        {trade.direction.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {trade.quantity ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtCurrency(trade.entry_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {trade.exit_price != null ? fmtCurrency(trade.exit_price) : '—'}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                      {isProfit ? '+' : ''}{fmtCurrency(pnl)}
                      {trade.pnl_percent != null && (
                        <span className="ml-1 opacity-70">
                          ({fmtPct(trade.pnl_percent)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          trade.status === 'closed'
                            ? ''
                            : trade.status === 'stopped'
                              ? 'border-loss/30 text-loss'
                              : 'border-primary/30 text-primary'
                        }
                      >
                        {(trade.status ?? 'closed').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
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
    <section className="hero-section rounded border border-border">
      <div className="relative z-10">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="data-label">Helios Signals</p>
            <span className="status-live">Live</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" />
            <span>{positions.length} Open</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h1 className={`font-mono text-3xl font-bold tabular-nums sm:text-4xl ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {isPositive ? '+' : ''}{fmtCurrency(totalPnL)}
          </h1>
          <span className="text-xs text-muted-foreground">combined P&L</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* Header */}
        <header>
          <p className="data-label">Signals</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Helios</h1>
        </header>

        {/* Summary */}
        <SummaryHeader positions={positions} weeklyData={weeklyData} />

        {/* Beta Notice */}
        <Card className="border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-semibold text-foreground">Live Feed</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Real-time data. Copy-trading via SnapTrade coming soon.
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
