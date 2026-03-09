'use client';

import { TrendingUp, TrendingDown, Zap, Trophy, Target } from 'lucide-react';
import { useTodayPnL } from '@/hooks/use-live-data';
import { formatCurrency } from '@/lib/utils-client';
import { AnimatedCounter } from '@/components/animated-counter';
import { PnLCardSkeleton } from '@/components/skeletons';

export function TodayPnLCard() {
  const { data, loading } = useTodayPnL();

  if (loading && !data) {
    return <PnLCardSkeleton />;
  }

  // Default to zero state if no data yet (market not open, no trades)
  const totalPnL = data?.totalPnL ?? 0;
  const totalTrades = data?.totalTrades ?? 0;
  const winRate = data?.winRate ?? 0;
  const wins = data?.wins ?? 0;
  const losses = data?.losses ?? 0;
  const isPositive = totalPnL >= 0;
  const hasTrades = totalTrades > 0;

  // Dynamic glow colors
  const glowColor = isPositive
    ? 'rgba(34, 197, 94, 0.15)'
    : 'rgba(239, 68, 68, 0.15)';
  const glowColorStrong = isPositive
    ? 'rgba(34, 197, 94, 0.25)'
    : 'rgba(239, 68, 68, 0.25)';
  const borderColor = isPositive
    ? 'border-profit/40'
    : totalPnL < 0
    ? 'border-loss/40'
    : 'border-primary/35';

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border ${borderColor} bg-[rgba(19,19,28,0.78)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-8 transition-all duration-500`}
      style={{
        boxShadow: hasTrades
          ? `0 0 60px ${glowColor}, 0 0 120px ${glowColor}, 0 24px 60px rgba(0,0,0,0.5)`
          : '0 24px 60px rgba(0,0,0,0.5)',
      }}
    >
      {/* Top gradient line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: hasTrades
            ? `linear-gradient(to right, transparent, ${isPositive ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'}, transparent)`
            : 'linear-gradient(to right, transparent, rgba(217, 70, 239, 0.7), transparent)',
        }}
      />

      {/* Background glow orb */}
      <div
        className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl transition-all duration-700"
        style={{
          background: hasTrades ? glowColorStrong : 'rgba(217, 70, 239, 0.12)',
        }}
      />

      {/* Secondary glow orb for extra depth */}
      {hasTrades && (
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full blur-3xl transition-all duration-700"
          style={{ background: glowColor }}
        />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-2 flex items-center gap-2">
          <Zap className={`h-4 w-4 ${hasTrades ? (isPositive ? 'text-profit' : 'text-loss') : 'text-primary'}`} />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Today&apos;s P&amp;L
          </p>
          {hasTrades && (
            <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isPositive
                ? 'border border-profit/30 bg-profit/15 text-profit'
                : 'border border-loss/30 bg-loss/15 text-loss'
            }`}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? 'Winning' : 'Down'}
            </span>
          )}
        </div>

        {/* Big P&L number */}
        <div className="mb-6">
          <h2
            className={`text-5xl font-extrabold tracking-tight sm:text-7xl ${
              hasTrades
                ? isPositive
                  ? 'text-profit'
                  : 'text-loss'
                : 'text-muted-foreground'
            }`}
          >
            {hasTrades ? (
              <>
                <span className="mr-1 text-4xl sm:text-5xl">{totalPnL >= 0 ? '+' : ''}</span>
                <AnimatedCounter
                  value={totalPnL}
                  duration={1200}
                  formatFn={formatCurrency}
                />
              </>
            ) : (
              <span className="opacity-50">$0</span>
            )}
          </h2>
          {!hasTrades && (
            <p className="mt-2 text-sm text-muted-foreground/60">
              No trades closed today yet
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Trades count */}
          <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Trades</span>
            </div>
            <p className="mt-0.5 text-xl font-bold text-foreground">
              <AnimatedCounter value={totalTrades} duration={800} />
            </p>
          </div>

          {/* Win rate */}
          <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Win Rate</span>
            </div>
            <p className={`mt-0.5 text-xl font-bold ${
              hasTrades
                ? winRate >= 50
                  ? 'text-profit'
                  : 'text-loss'
                : 'text-foreground'
            }`}>
              {hasTrades ? (
                <AnimatedCounter
                  value={winRate}
                  duration={800}
                  formatFn={(v) => `${v.toFixed(0)}%`}
                />
              ) : (
                '—'
              )}
            </p>
          </div>

          {/* W/L breakdown */}
          <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">W / L</span>
            </div>
            <p className="mt-0.5 text-xl font-bold">
              <span className="text-profit">{wins}</span>
              <span className="mx-1 text-muted-foreground">/</span>
              <span className="text-loss">{losses}</span>
            </p>
          </div>

          {/* Best trade (if exists) */}
          {data?.bestTrade && data.bestTrade.pnl > 0 && (
            <div className="hidden rounded-xl border border-profit/25 bg-profit/8 px-4 py-2.5 sm:block">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Best</div>
              <p className="mt-0.5 text-xl font-bold text-profit">
                +{formatCurrency(data.bestTrade.pnl)}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
