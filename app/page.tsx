'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { useTradeData, useMarketData, useAccountData, useSystemStatus } from "@/hooks/use-live-data";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils-client";

function LiveIndicator({ lastUpdate }: { lastUpdate: Date | null }) {
  if (!lastUpdate) return null;
  
  const secondsAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : 0;
  const isLive = secondsAgo < 60;
  
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-profit animate-pulse' : 'bg-muted-foreground'}`} />
      <span className="text-xs text-muted-foreground">
        {isLive ? 'Live' : `${secondsAgo}s ago`}
      </span>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur animate-pulse">
      <CardContent className="p-6">
        <div className="h-8 w-32 bg-muted rounded mb-4" />
        <div className="h-12 w-48 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-loss/50 bg-loss/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 text-loss">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioHeader() {
  const { data: trades, loading: tradesLoading, error: tradesError } = useTradeData();
  const { data: accounts, loading: accountsLoading } = useAccountData();
  const { data: market, lastUpdate } = useMarketData('QQQ');
  
  if (tradesLoading || accountsLoading) {
    return <LoadingCard />;
  }
  
  if (tradesError || !trades) {
    return <ErrorCard message="Failed to load portfolio data" />;
  }
  
  const totalPnL = trades.summary.totalPnL;
  const accountBalance = accounts?.totalBalance || 90000; // fallback
  const totalValue = accountBalance + totalPnL;
  const totalReturn = (totalPnL / accountBalance) * 100;
  
  const isPositive = totalPnL >= 0;
  
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary p-8">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-profit animate-pulse" />
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Portfolio Value
            </p>
          </div>
          <LiveIndicator lastUpdate={lastUpdate} />
        </div>
        <div className="flex items-baseline gap-4 mb-6">
          <h1 className={`text-6xl font-bold tracking-tight ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(totalValue)}
          </h1>
          <div className="flex items-center gap-2">
            {isPositive ? (
              <ArrowUpRight className="h-6 w-6 text-profit" />
            ) : (
              <ArrowDownRight className="h-6 w-6 text-loss" />
            )}
            <span className={`text-2xl font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
              {formatPercent(totalReturn)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">P&L:</span>
            <span className={`text-lg font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(totalPnL)}
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          {market && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">QQQ:</span>
              <span className="text-lg font-semibold text-foreground">
                ${market.price.toFixed(2)}
              </span>
              <span className={`text-sm ${market.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                {market.change >= 0 ? '+' : ''}{market.changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
      {isPositive && (
        <div className="absolute top-0 right-0 w-96 h-96 bg-profit/5 rounded-full blur-3xl" />
      )}
    </div>
  );
}

function StatsGrid() {
  const { data: trades, loading, error } = useTradeData();
  const { data: status } = useSystemStatus();
  
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <LoadingCard key={i} />)}
      </div>
    );
  }
  
  if (error || !trades) {
    return <ErrorCard message="Failed to load statistics" />;
  }
  
  const summary = trades.summary;
  const meridianRunning = status?.systems.meridian.status === 'running';
  
  const stats = [
    {
      label: "Win Rate",
      value: `${summary.winRate.toFixed(1)}%`,
      change: summary.winRate >= 50 ? "up" : "down",
      icon: Target,
      color: summary.winRate >= 50 ? "profit" : "loss"
    },
    {
      label: "Profit Factor",
      value: summary.profitFactor.toFixed(2),
      change: summary.profitFactor >= 1.5 ? "up" : "down",
      icon: BarChart3,
      color: summary.profitFactor >= 1.5 ? "profit" : "loss"
    },
    {
      label: "Total Trades",
      value: summary.totalTrades.toString(),
      icon: Activity,
      color: "muted"
    },
    {
      label: "System Status",
      value: meridianRunning ? "Running" : "Offline",
      icon: RefreshCw,
      color: meridianRunning ? "profit" : "loss"
    },
  ];
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <Card key={i} className="border-border/50 bg-card/50 backdrop-blur hover:bg-card/80 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-lg ${
                  stat.color === 'profit' ? 'bg-profit/10' :
                  stat.color === 'loss' ? 'bg-loss/10' :
                  'bg-muted/30'
                }`}>
                  <Icon className={`h-4 w-4 ${
                    stat.color === 'profit' ? 'text-profit' :
                    stat.color === 'loss' ? 'text-loss' :
                    'text-muted-foreground'
                  }`} />
                </div>
                {stat.change && (
                  stat.change === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-profit" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-loss" />
                  )
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-2xl font-bold ${
                  stat.color === 'profit' ? 'text-profit' :
                  stat.color === 'loss' ? 'text-loss' :
                  'text-foreground'
                }`}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecentActivity() {
  const { data: trades, loading, error } = useTradeData();
  
  if (loading) {
    return <LoadingCard />;
  }
  
  if (error || !trades) {
    return <ErrorCard message="Failed to load recent trades" />;
  }
  
  const recentTrades = trades.trades.slice(0, 10);
  
  return (
    <Card className="col-span-full border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Recent Activity</CardTitle>
          <a 
            href="/trades" 
            className="text-sm text-profit hover:text-profit/80 transition-colors font-medium"
          >
            View all →
          </a>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/30">
          {recentTrades.map((trade: any, i: number) => {
            const isWin = trade.profit_loss && parseFloat(trade.profit_loss) >= 0;
            const direction = trade.direction || 'UNKNOWN';
            
            return (
              <div 
                key={i} 
                className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${
                    direction === 'LONG' || direction === 'BUY' 
                      ? 'bg-profit/10' 
                      : 'bg-loss/10'
                  }`}>
                    {direction === 'LONG' || direction === 'BUY' ? (
                      <TrendingUp className="h-5 w-5 text-profit" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-loss" />
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{trade.symbol || 'N/A'}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          direction === 'LONG' || direction === 'BUY'
                            ? 'border-profit/30 text-profit' 
                            : 'border-loss/30 text-loss'
                        }`}
                      >
                        {direction}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {trade.created_at ? formatDate(trade.created_at) : 'Unknown date'}
                      {trade.entry_price && ` • Entry: $${parseFloat(trade.entry_price).toFixed(2)}`}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-lg font-bold ${isWin ? 'text-profit' : 'text-loss'}`}>
                    {trade.profit_loss ? (
                      <>
                        {isWin && '+'}{formatCurrency(parseFloat(trade.profit_loss))}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {trade.status || 'Unknown'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-12">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <PortfolioHeader />
        <StatsGrid />
        <RecentActivity />
      </div>
    </div>
  );
}
