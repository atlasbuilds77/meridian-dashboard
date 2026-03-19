'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Eye,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface OracleTrade {
  id: number;
  timestamp: string;
  asset: string;
  direction: string;
  market_type: string;
  shares: number;
  entry_price: number;
  cost: number;
  edge: number;
  model_prob: number;
  outcome: string;
  payout: number;
  profit: number;
}

interface NightWatchTrade {
  id: string;
  market_id: string;
  side: string;
  price: number;
  size: number;
  stake_usd: number;
  status: string;
  dry_run: number;
  created_at: string;
}

interface NightWatchPosition {
  market_id: string;
  direction: string;
  entry_price: number;
  current_price: number;
  pnl: number;
  question: string;
  market_type: string;
  stake_usd: number;
}

interface SignalFeedProps {
  oracleTrades: OracleTrade[];
  nightwatchTrades: NightWatchTrade[];
  nightwatchPositions: NightWatchPosition[];
  loading?: boolean;
  variant?: 'combined' | 'oracle' | 'nightwatch';
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function OracleSignalRow({ trade }: { trade: OracleTrade }) {
  const isWin = trade.outcome === 'win';
  const isPending = trade.outcome === 'pending' || !trade.outcome;
  const isUp = trade.direction === 'UP';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-secondary/20 p-3 transition-colors hover:bg-secondary/40">
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
        isUp ? 'border-profit/30 bg-profit/15' : 'border-loss/30 bg-loss/15'
      )}>
        {isUp ? (
          <ArrowUpRight className="h-4 w-4 text-profit" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-loss" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-amber-500" />
          <span className="text-xs font-semibold uppercase text-amber-500">Oracle</span>
          <span className="font-semibold text-foreground">{trade.asset?.toUpperCase()}</span>
          <Badge variant="outline" className={cn(
            'text-[10px]',
            isUp ? 'border-profit/40 text-profit' : 'border-loss/40 text-loss'
          )}>
            {trade.direction}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{trade.market_type}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Edge: {(trade.edge * 100).toFixed(1)}%</span>
          <span>Prob: {(trade.model_prob * 100).toFixed(0)}%</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(trade.timestamp)}
          </span>
        </div>
      </div>

      <div className="text-right">
        {isPending ? (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
            PENDING
          </Badge>
        ) : (
          <div className={cn(
            'text-sm font-bold',
            isWin ? 'text-profit' : 'text-loss'
          )}>
            {isWin ? '+' : ''}{trade.profit?.toFixed(2) || '0.00'}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">USD</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NightWatchTradeRow({ trade }: { trade: NightWatchTrade }) {
  const isBuy = trade.side?.includes('BUY');
  const isSimulated = trade.status === 'SIMULATED' || trade.dry_run === 1;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-secondary/20 p-3 transition-colors hover:bg-secondary/40">
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
        isBuy ? 'border-profit/30 bg-profit/15' : 'border-loss/30 bg-loss/15'
      )}>
        {isBuy ? (
          <ArrowUpRight className="h-4 w-4 text-profit" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-loss" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Eye className="h-3 w-3 text-blue-500" />
          <span className="text-xs font-semibold uppercase text-blue-500">NightWatch</span>
          <Badge variant="outline" className={cn(
            'text-[10px]',
            isBuy ? 'border-profit/40 text-profit' : 'border-loss/40 text-loss'
          )}>
            {trade.side}
          </Badge>
          {isSimulated && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
              PAPER
            </Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Price: {trade.price?.toFixed(3)}</span>
          <span>Size: {trade.size?.toFixed(0)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(trade.created_at)}
          </span>
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm font-semibold text-foreground">
          ${trade.stake_usd?.toFixed(0)}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">staked</span>
        </div>
      </div>
    </div>
  );
}

function NightWatchPositionRow({ position }: { position: NightWatchPosition }) {
  const isUp = position.pnl >= 0;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 transition-colors hover:bg-primary/10">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
        <TrendingUp className="h-4 w-4 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Eye className="h-3 w-3 text-blue-500" />
          <span className="text-xs font-semibold uppercase text-blue-500">Open Position</span>
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
            {position.market_type}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground max-w-[280px]">
          {position.question}
        </p>
      </div>

      <div className="text-right">
        <div className={cn('text-sm font-bold', isUp ? 'text-profit' : 'text-loss')}>
          {isUp ? '+' : ''}{position.pnl?.toFixed(2)}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">P&L</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          ${position.stake_usd?.toFixed(0)} staked
        </div>
      </div>
    </div>
  );
}

export function SignalFeed({ oracleTrades, nightwatchTrades, nightwatchPositions, loading, variant = 'combined' }: SignalFeedProps) {
  if (loading) {
    return (
      <Card className="border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur">
        <CardHeader className="border-b border-primary/20 pb-4">
          <div className="animate-pulse h-6 w-40 rounded bg-white/10" />
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse h-16 rounded-xl bg-white/5" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Merge and sort all signals by time
  const allSignals: { type: 'oracle' | 'nightwatch-trade' | 'nightwatch-position'; time: string; data: unknown }[] = [];

  oracleTrades.forEach(t => allSignals.push({ type: 'oracle', time: t.timestamp, data: t }));
  nightwatchTrades.forEach(t => allSignals.push({ type: 'nightwatch-trade', time: t.created_at, data: t }));

  allSignals.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const hasData = allSignals.length > 0 || nightwatchPositions.length > 0;

  return (
    <Card className="border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur">
      <CardHeader className="border-b border-primary/20 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">
            {variant === 'oracle' ? 'Oracle Activity' : variant === 'nightwatch' ? 'NightWatch Activity' : 'Signal Feed'}
          </CardTitle>
          <Badge variant="secondary" className={cn(
            "text-xs",
            variant === 'oracle' && "bg-amber-500/20 text-amber-500",
            variant === 'nightwatch' && "bg-blue-500/20 text-blue-500"
          )}>
            {allSignals.length + (variant === 'nightwatch' ? nightwatchPositions.length : 0)} {variant === 'nightwatch' && nightwatchPositions.length > 0 ? 'items' : 'signals'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {!hasData ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-secondary/15 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No signals yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Signals will appear here when bots generate them.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Open positions first */}
            {nightwatchPositions.length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">Open Positions</p>
                {nightwatchPositions.map((p, i) => (
                  <NightWatchPositionRow key={`pos-${i}`} position={p} />
                ))}
                {allSignals.length > 0 && (
                  <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</p>
                )}
              </>
            )}

            {/* Recent signals */}
            {allSignals.slice(0, 15).map((signal, i) => {
              if (signal.type === 'oracle') {
                return <OracleSignalRow key={`oracle-${i}`} trade={signal.data as OracleTrade} />;
              }
              return <NightWatchTradeRow key={`nw-${i}`} trade={signal.data as NightWatchTrade} />;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
