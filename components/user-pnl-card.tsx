'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiveData } from '@/hooks/use-live-data';
import {
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Activity,
  BarChart3,
  Zap,
  Eye,
  Clock,
} from 'lucide-react';

interface UserPosition {
  id: number;
  bot: 'oracle' | 'nightwatch';
  asset: string | null;
  question: string | null;
  marketType: string | null;
  direction: string;
  side: string;
  shares: number;
  entryPrice: number;
  currentPrice: number | null;
  stakeUsd: number;
  pnl: number;
  pnlPercent: number;
  executionStatus: string;
  dryRun: boolean;
  outcome: string | null;
  payout: number | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

interface UserPnLSummary {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalPnL: number;
  openPnL: number;
  realizedPnL: number;
  totalStaked: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface UserPnLResponse {
  positions: UserPosition[];
  summary: UserPnLSummary;
  timestamp: string;
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

function StatBox({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: typeof Activity;
  color?: 'profit' | 'loss' | 'default';
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn(
          'h-3.5 w-3.5',
          color === 'profit' ? 'text-profit' :
          color === 'loss' ? 'text-loss' :
          'text-primary'
        )} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={cn(
        'text-lg font-bold',
        color === 'profit' ? 'text-profit' :
        color === 'loss' ? 'text-loss' :
        'text-foreground'
      )}>
        {value}
      </p>
    </div>
  );
}

function PositionRow({ position }: { position: UserPosition }) {
  const isOracle = position.bot === 'oracle';
  const isOpen = position.status === 'open';
  const pnlPositive = position.pnl >= 0;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary/40',
      isOpen ? 'border-primary/20 bg-primary/5' : 'border-border/30 bg-secondary/20'
    )}>
      {/* Bot icon */}
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
        isOracle ? 'border-amber-500/30 bg-amber-500/15' : 'border-blue-500/30 bg-blue-500/15'
      )}>
        {isOracle ? (
          <Zap className="h-4 w-4 text-amber-500" />
        ) : (
          <Eye className="h-4 w-4 text-blue-500" />
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-semibold uppercase',
            isOracle ? 'text-amber-500' : 'text-blue-500'
          )}>
            {position.bot}
          </span>
          {position.asset && (
            <span className="font-semibold text-foreground">{position.asset.toUpperCase()}</span>
          )}
          <Badge variant="outline" className={cn(
            'text-[10px]',
            position.side === 'BUY' ? 'border-profit/40 text-profit' : 'border-loss/40 text-loss'
          )}>
            {position.direction}
          </Badge>
          {position.dryRun && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">PAPER</Badge>
          )}
          {isOpen && (
            <Badge className="bg-profit/20 text-profit border-profit/30 text-[10px]">OPEN</Badge>
          )}
        </div>
        {position.question && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground max-w-[280px]">
            {position.question}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>${position.stakeUsd.toFixed(0)} staked</span>
          <span>@ {position.entryPrice.toFixed(3)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(position.openedAt)}
          </span>
        </div>
      </div>

      {/* P&L */}
      <div className="text-right">
        {position.outcome ? (
          <Badge className={cn(
            'text-[10px]',
            position.outcome === 'win'
              ? 'bg-profit/20 text-profit border-profit/30'
              : 'bg-loss/20 text-loss border-loss/30'
          )}>
            {position.outcome.toUpperCase()}
          </Badge>
        ) : (
          <div className={cn(
            'text-sm font-bold',
            pnlPositive ? 'text-profit' : 'text-loss'
          )}>
            {pnlPositive ? '+' : ''}{position.pnl.toFixed(2)}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">USD</span>
          </div>
        )}
        {position.payout !== null && (
          <p className="text-xs text-muted-foreground">
            Payout: ${position.payout.toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}

export function UserPnLCard() {
  const { data, loading } = useLiveData<UserPnLResponse>('/api/prediction-markets/user-pnl', 30_000);

  if (loading && !data) {
    return (
      <Card className="border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-40 rounded bg-white/10" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 rounded-xl bg-white/5" />
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = data?.summary;
  const positions = data?.positions || [];
  const hasPositions = positions.length > 0;
  const totalPnL = summary?.totalPnL || 0;
  const isPositive = totalPnL >= 0;

  return (
    <Card className="border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur">
      <CardHeader className="border-b border-primary/20 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <BarChart3 className="h-5 w-5 text-primary" />
            Your Copy-Trade P&L
          </CardTitle>
          {summary && (
            <span className={cn(
              'text-2xl font-bold',
              isPositive ? 'text-profit' : 'text-loss'
            )}>
              {isPositive ? '+' : ''}${Math.abs(totalPnL).toFixed(2)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Summary stats */}
        {summary && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox
              label="Open P&L"
              value={`${summary.openPnL >= 0 ? '+' : ''}$${Math.abs(summary.openPnL).toFixed(2)}`}
              icon={summary.openPnL >= 0 ? TrendingUp : TrendingDown}
              color={summary.openPnL >= 0 ? 'profit' : 'loss'}
            />
            <StatBox
              label="Realized"
              value={`${summary.realizedPnL >= 0 ? '+' : ''}$${Math.abs(summary.realizedPnL).toFixed(2)}`}
              icon={DollarSign}
              color={summary.realizedPnL >= 0 ? 'profit' : 'loss'}
            />
            <StatBox
              label="Win Rate"
              value={summary.closedPositions > 0 ? `${(summary.winRate * 100).toFixed(0)}%` : '—'}
              icon={Target}
              color={summary.winRate >= 0.5 ? 'profit' : summary.closedPositions > 0 ? 'loss' : 'default'}
            />
            <StatBox
              label="Positions"
              value={`${summary.openPositions} open / ${summary.totalPositions} total`}
              icon={Activity}
            />
          </div>
        )}

        {/* Positions list */}
        {!hasPositions ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-secondary/15 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No copy-trade positions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Positions will appear here when Oracle or NightWatch execute trades for you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Open positions first */}
            {positions.filter(p => p.status === 'open').length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">Open Positions</p>
                {positions.filter(p => p.status === 'open').map(p => (
                  <PositionRow key={p.id} position={p} />
                ))}
              </>
            )}

            {/* Closed positions */}
            {positions.filter(p => p.status === 'closed').length > 0 && (
              <>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Closed</p>
                {positions.filter(p => p.status === 'closed').slice(0, 10).map(p => (
                  <PositionRow key={p.id} position={p} />
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
