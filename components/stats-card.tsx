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
    <Card
      className={cn(
        'border-primary/30 bg-[rgba(19,19,28,0.72)] hover:border-primary/55 hover:shadow-[0_14px_36px_rgba(147,51,234,0.24)]',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium uppercase tracking-[0.12em]">{title}</CardTitle>
        {icon && <div className="text-primary">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'font-bold tracking-tight',
            large ? 'text-4xl md:text-5xl' : 'text-2xl',
            trend === 'up' && 'text-profit',
            trend === 'down' && 'text-loss'
          )}
        >
          {value}
        </div>
        {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
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
    <Card
      className={cn(
        'relative overflow-hidden border-2 transition-all duration-300',
        isPositive ? 'border-profit/35 bg-profit/10' : 'border-loss/35 bg-loss/10'
      )}
    >
      <div
        className={cn(
          'absolute inset-0 opacity-20',
          isPositive ? 'bg-gradient-to-br from-profit/35 to-transparent' : 'bg-gradient-to-br from-loss/35 to-transparent'
        )}
      />
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium uppercase tracking-[0.12em]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-4xl font-bold tracking-tight md:text-6xl', isPositive ? 'text-profit' : 'text-loss')}>
          {isPositive ? '+' : '-'}
          {formatted}
        </div>
        {subtitle && <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
