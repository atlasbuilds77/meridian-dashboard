'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  Eye,
  Target,
  DollarSign,
} from 'lucide-react';

interface BotStats {
  // Oracle stats
  total_trades?: number;
  wins?: number;
  losses?: number;
  pending?: number;
  total_invested?: number;
  total_returned?: number;
  total_profit?: number;
  win_rate?: number;
  // NightWatch stats
  totalTrades?: number;
  buyTrades?: number;
  sellTrades?: number;
  totalStaked?: number;
  openPositions?: number;
  openPnL?: number;
}

interface PredictionMarketCardProps {
  name: string;
  description: string;
  status: 'online' | 'stopped' | 'offline' | 'unknown' | 'error';
  stats: BotStats | null;
  variant: 'oracle' | 'nightwatch';
  loading?: boolean;
}

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === 'online'
      ? 'bg-profit animate-pulse'
      : status === 'stopped'
        ? 'bg-yellow-500'
        : 'bg-loss';

  return <div className={cn('h-2.5 w-2.5 rounded-full', colorClass)} />;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'online' ? 'border-profit/40 bg-profit/15 text-profit' :
    status === 'stopped' ? 'border-yellow-500/40 bg-yellow-500/15 text-yellow-500' :
    'border-loss/40 bg-loss/15 text-loss';

  return (
    <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider', variant)}>
      {status}
    </span>
  );
}

function StatItem({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Activity; color?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg border',
        color === 'profit' ? 'border-profit/30 bg-profit/10' :
        color === 'loss' ? 'border-loss/30 bg-loss/10' :
        'border-primary/30 bg-primary/10'
      )}>
        <Icon className={cn(
          'h-3.5 w-3.5',
          color === 'profit' ? 'text-profit' :
          color === 'loss' ? 'text-loss' :
          'text-primary'
        )} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function PredictionMarketCard({ name, description, status, stats, variant, loading }: PredictionMarketCardProps) {
  const isOracle = variant === 'oracle';
  const gradientClass = isOracle
    ? 'from-amber-500/20 via-transparent to-transparent'
    : 'from-blue-500/20 via-transparent to-transparent';
  const iconBgClass = isOracle ? 'bg-amber-500/15 border-amber-500/30' : 'bg-blue-500/15 border-blue-500/30';
  const iconTextClass = isOracle ? 'text-amber-500' : 'text-blue-500';

  if (loading) {
    return (
      <Card className="border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/10" />
              <div className="space-y-2">
                <div className="h-5 w-24 rounded bg-white/10" />
                <div className="h-3 w-40 rounded bg-white/10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 rounded-lg bg-white/5" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden border-primary/30 bg-[rgba(19,19,28,0.72)] backdrop-blur hover:border-primary/55 hover:shadow-[0_14px_36px_rgba(147,51,234,0.24)] transition-all duration-300">
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100', gradientClass)} />

      <CardContent className="relative z-10 p-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl border', iconBgClass)}>
              {isOracle ? (
                <Zap className={cn('h-6 w-6', iconTextClass)} />
              ) : (
                <Eye className={cn('h-6 w-6', iconTextClass)} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-foreground">{name}</h3>
                <StatusDot status={status} />
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Stats Grid */}
        {stats ? (
          <div className="grid grid-cols-2 gap-4">
            {isOracle ? (
              <>
                <StatItem
                  label="Total Trades"
                  value={String(stats.total_trades || 0)}
                  icon={Activity}
                />
                <StatItem
                  label="Win Rate"
                  value={`${((stats.win_rate || 0) * 100).toFixed(0)}%`}
                  icon={Target}
                  color={(stats.win_rate || 0) >= 0.5 ? 'profit' : 'loss'}
                />
                <StatItem
                  label="Total Profit"
                  value={`$${(stats.total_profit || 0).toFixed(2)}`}
                  icon={DollarSign}
                  color={(stats.total_profit || 0) >= 0 ? 'profit' : 'loss'}
                />
                <StatItem
                  label="Pending"
                  value={String(stats.pending || 0)}
                  icon={Activity}
                />
              </>
            ) : (
              <>
                <StatItem
                  label="Total Trades"
                  value={String(stats.totalTrades || 0)}
                  icon={Activity}
                />
                <StatItem
                  label="Open Positions"
                  value={String(stats.openPositions || 0)}
                  icon={Target}
                />
                <StatItem
                  label="Total Staked"
                  value={`$${(stats.totalStaked || 0).toFixed(0)}`}
                  icon={DollarSign}
                />
                <StatItem
                  label="Open P&L"
                  value={`$${(stats.openPnL || 0).toFixed(2)}`}
                  icon={stats.openPnL && stats.openPnL >= 0 ? TrendingUp : TrendingDown}
                  color={(stats.openPnL || 0) >= 0 ? 'profit' : 'loss'}
                />
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 bg-secondary/15 py-6 text-center">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
