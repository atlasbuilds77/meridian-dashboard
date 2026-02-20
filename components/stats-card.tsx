"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  large = false
}: StatsCardProps) {
  return (
    <Card className={cn(
      "bg-card border-border/50 hover:border-border transition-colors",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className={cn(
          "font-bold tracking-tight",
          large ? "text-4xl md:text-5xl" : "text-2xl",
          trend === 'up' && "text-emerald-500",
          trend === 'down' && "text-red-500"
        )}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface PnLCardProps {
  value: number;
  title?: string;
  subtitle?: string;
}

export function PnLCard({ value, title = "Total P&L", subtitle }: PnLCardProps) {
  const isPositive = value >= 0;
  const formatted = Math.abs(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return (
    <Card className={cn(
      "relative overflow-hidden border-2 transition-all duration-300",
      isPositive 
        ? "border-emerald-500/30 bg-emerald-500/5" 
        : "border-red-500/30 bg-red-500/5"
    )}>
      <div className={cn(
        "absolute inset-0 opacity-10",
        isPositive 
          ? "bg-gradient-to-br from-emerald-500 to-transparent" 
          : "bg-gradient-to-br from-red-500 to-transparent"
      )} />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-4xl md:text-6xl font-bold tracking-tight",
          isPositive ? "text-emerald-500" : "text-red-500"
        )}>
          {isPositive ? '+' : '-'}{formatted}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-2">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
