import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Trade card skeleton for mobile/desktop trade lists
 */
export function TradeCardSkeleton() {
  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 animate-pulse">
        {/* Top row: Symbol + Direction + P&L */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 bg-muted/30 rounded" />
            <div className="h-6 w-20 bg-muted/30 rounded-full" />
          </div>
          <div className="h-7 w-24 bg-muted/30 rounded" />
        </div>

        {/* Strike + Expiry row */}
        <div className="flex items-center gap-4 mb-2">
          <div className="h-4 w-20 bg-muted/30 rounded" />
          <div className="h-4 w-16 bg-muted/30 rounded" />
          <div className="h-4 w-24 bg-muted/30 rounded" />
        </div>

        {/* Entry/Exit row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-12 bg-muted/30 rounded" />
            <div className="h-4 w-16 bg-muted/30 rounded" />
            <div className="h-4 w-4 bg-muted/30 rounded" />
            <div className="h-4 w-16 bg-muted/30 rounded" />
          </div>
        </div>

        {/* P&L breakdown */}
        <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
          <div className="h-3 w-20 bg-muted/30 rounded" />
          <div className="h-3 w-20 bg-muted/30 rounded" />
          <div className="h-3 w-28 bg-muted/30 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * P&L card skeleton (for today's P&L hero card)
 */
export function PnLCardSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/35 bg-[rgba(19,19,28,0.78)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-8">
      <div className="animate-pulse">
        {/* Header */}
        <div className="mb-4 h-5 w-40 bg-muted/30 rounded" />
        
        {/* Big P&L number */}
        <div className="mb-6 h-16 w-64 bg-muted/30 rounded" />
        
        {/* Stats row */}
        <div className="flex gap-4">
          <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-2.5">
            <div className="h-4 w-16 bg-muted/30 rounded mb-1" />
            <div className="h-6 w-12 bg-muted/30 rounded" />
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-2.5">
            <div className="h-4 w-16 bg-muted/30 rounded mb-1" />
            <div className="h-6 w-12 bg-muted/30 rounded" />
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-2.5">
            <div className="h-4 w-12 bg-muted/30 rounded mb-1" />
            <div className="h-6 w-16 bg-muted/30 rounded" />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Chart skeleton (for heatmap or other charts)
 */
export function ChartSkeleton() {
  return (
    <Card className="border-primary/30 bg-[rgba(19,19,28,0.72)]">
      <CardHeader>
        <div className="animate-pulse">
          <div className="h-5 w-32 bg-muted/30 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse flex items-center justify-center h-32">
          <div className="grid grid-cols-12 gap-1 w-full max-w-md">
            {Array.from({ length: 84 }).map((_, i) => (
              <div key={i} className="h-3 w-3 bg-muted/30 rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Table row skeleton (for trade tables)
 */
export function TableRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-primary/15 animate-pulse">
      <div className="flex items-center gap-4">
        {/* Icon placeholder */}
        <div className="h-10 w-10 rounded-lg bg-muted/30" />
        
        {/* Symbol + direction */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-16 bg-muted/30 rounded" />
            <div className="h-5 w-20 bg-muted/30 rounded-full" />
          </div>
          <div className="h-3 w-32 bg-muted/30 rounded" />
        </div>
      </div>

      {/* P&L + status */}
      <div className="text-left sm:text-right">
        <div className="h-6 w-24 bg-muted/30 rounded mb-1" />
        <div className="h-3 w-16 bg-muted/30 rounded" />
      </div>
    </div>
  );
}

/**
 * Stats card skeleton (for dashboard stats grid)
 */
export function StatsCardSkeleton() {
  return (
    <Card className="border-primary/30">
      <CardContent className="p-6 animate-pulse">
        <div className="mb-4 flex items-start justify-between">
          <div className="rounded-xl border border-primary/35 bg-primary/10 p-2">
            <div className="h-4 w-4 bg-muted/30 rounded" />
          </div>
          <div className="h-4 w-4 bg-muted/30 rounded" />
        </div>
        <div>
          <div className="h-3 w-20 bg-muted/30 rounded mb-2" />
          <div className="h-8 w-16 bg-muted/30 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Portfolio header skeleton (for main dashboard header)
 */
export function PortfolioHeaderSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/35 bg-[rgba(19,19,28,0.78)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      
      <div className="relative z-10 animate-pulse">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="h-3 w-32 bg-muted/30 rounded" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-16 bg-muted/30 rounded-full" />
            <div className="h-6 w-8 bg-muted/30 rounded-full" />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="h-14 w-48 bg-muted/30 rounded" />
          <div className="h-8 w-24 bg-muted/30 rounded-full" />
          <div className="hidden sm:block h-10 w-32 bg-muted/30 rounded" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="h-10 w-32 bg-muted/30 rounded-lg" />
          <div className="h-10 w-40 bg-muted/30 rounded-lg" />
        </div>
      </div>
    </section>
  );
}

/**
 * Composite skeleton for full dashboard loading state
 */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted/30" />
            <div className="space-y-2">
              <div className="h-3 w-32 bg-muted/30 rounded" />
              <div className="h-8 w-40 bg-muted/30 rounded" />
            </div>
          </div>
          <div className="h-10 w-32 bg-muted/30 rounded-lg" />
        </header>

        <PnLCardSkeleton />
        <PortfolioHeaderSkeleton />
        
        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        {/* Recent activity */}
        <Card className="col-span-full border-primary/30">
          <CardHeader className="border-b border-primary/20 pb-4 animate-pulse">
            <div className="h-6 w-32 bg-muted/30 rounded" />
          </CardHeader>
          <CardContent className="p-0">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
