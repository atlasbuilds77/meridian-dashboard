'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
  large?: boolean;
}

export function StatsCard({
  title,
  value,
  subtitle,
  trend = 'neutral',
  icon,
  className,
  large = false,
}: StatsCardProps) {
  return (
    <Card className={cn('hover:border-border/80', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="data-label">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'font-mono font-semibold tabular-nums',
            large ? 'text-2xl md:text-3xl' : 'text-lg',
            trend === 'up' && 'text-profit',
            trend === 'down' && 'text-loss'
          )}
        >
          {value}
        </div>
        {subtitle && <p className="text-muted-foreground mt-0.5 text-[10px]">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

interface PnLCardProps {
  value: number;
  title?: string;
  subtitle?: string;
}

export function PnLCard({ value, title = 'Total P&L', subtitle }: PnLCardProps) {
  const isPositive = value >= 0;
  const formatted = Math.abs(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <Card className={cn('border', isPositive ? 'border-profit/30' : 'border-loss/30')}>
      <CardHeader className="pb-1">
        <CardTitle className="data-label">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('font-mono text-2xl font-bold tabular-nums md:text-4xl', isPositive ? 'text-profit' : 'text-loss')}>
          {isPositive ? '+' : '-'}
          {formatted}
        </div>
        {subtitle && <p className="text-muted-foreground mt-1 text-[10px]">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
