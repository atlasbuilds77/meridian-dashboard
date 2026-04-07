import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Trade card skeleton for mobile/desktop trade lists
 */
export function TradeCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-3 animate-pulse">
        {/* Top row: Symbol + Direction + P&L */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-14 bg-muted/30 rounded" />
            <div className="h-4 w-12 bg-muted/30 rounded" />
          </div>
          <div className="h-5 w-20 bg-muted/30 rounded" />
        </div>

        {/* Strike + Expiry row */}
        <div className="flex items-center gap-3 mb-1.5">
          <div className="h-3 w-16 bg-muted/30 rounded" />
          <div className="h-3 w-12 bg-muted/30 rounded" />
        </div>

        {/* Entry/Exit row */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-10 bg-muted/30 rounded" />
          <div className="h-3 w-14 bg-muted/30 rounded" />
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
    <section className="hero-section rounded border border-border">
      <div className="animate-pulse">
        {/* Header */}
        <div className="mb-2 h-3 w-24 bg-muted/30 rounded" />
        
        {/* Big P&L number */}
        <div className="mb-4 h-10 w-48 bg-muted/30 rounded" />
        
        {/* Stats row */}
        <div className="flex gap-2">
          <div className="stat-box rounded flex-1">
            <div className="h-2 w-12 bg-muted/30 rounded mb-1" />
            <div className="h-5 w-16 bg-muted/30 rounded" />
          </div>
          <div className="stat-box rounded flex-1">
            <div className="h-2 w-12 bg-muted/30 rounded mb-1" />
            <div className="h-5 w-16 bg-muted/30 rounded" />
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
    <Card>
      <CardHeader>
        <div className="animate-pulse">
          <div className="h-3 w-24 bg-muted/30 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse flex items-center justify-center h-24">
          <div className="grid grid-cols-12 gap-0.5 w-full max-w-sm">
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} className="h-2 w-2 bg-muted/30" />
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
    <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-border animate-pulse">
      <div className="flex items-center gap-3">
        {/* Icon placeholder */}
        <div className="h-7 w-7 rounded bg-muted/30" />
        
        {/* Symbol + direction */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-4 w-14 bg-muted/30 rounded" />
            <div className="h-4 w-12 bg-muted/30 rounded" />
          </div>
          <div className="h-2.5 w-24 bg-muted/30 rounded" />
        </div>
      </div>

      {/* P&L + status */}
      <div className="text-left sm:text-right">
        <div className="h-4 w-20 bg-muted/30 rounded mb-0.5" />
        <div className="h-2.5 w-12 bg-muted/30 rounded" />
      </div>
    </div>
  );
}

/**
 * Stats card skeleton (for dashboard stats grid)
 */
export function StatsCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-3 animate-pulse">
        <div className="mb-2 flex items-start justify-between">
          <div className="h-3.5 w-3.5 bg-muted/30 rounded" />
          <div className="h-3 w-3 bg-muted/30 rounded" />
        </div>
        <div>
          <div className="h-2 w-16 bg-muted/30 rounded mb-1" />
          <div className="h-5 w-12 bg-muted/30 rounded" />
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
    <section className="hero-section rounded border border-border">
      <div className="relative z-10 animate-pulse">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="h-2 w-24 bg-muted/30 rounded" />
          <div className="flex items-center gap-2">
            <div className="h-4 w-12 bg-muted/30 rounded" />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <div className="h-10 w-40 bg-muted/30 rounded" />
          <div className="h-6 w-16 bg-muted/30 rounded" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="stat-box rounded h-12 w-28" />
          <div className="stat-box rounded h-12 w-32" />
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
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded border border-border bg-muted/30" />
            <div>
              <div className="h-2 w-20 bg-muted/30 rounded mb-1" />
              <div className="h-5 w-28 bg-muted/30 rounded" />
            </div>
          </div>
          <div className="h-7 w-20 bg-muted/30 rounded" />
        </header>

        <PnLCardSkeleton />
        <PortfolioHeaderSkeleton />
        
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        {/* Recent activity */}
        <Card className="col-span-full">
          <CardHeader className="border-b border-border pb-3 animate-pulse">
            <div className="h-4 w-24 bg-muted/30 rounded" />
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
