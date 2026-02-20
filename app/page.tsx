import { getBacktestData, formatCurrency, formatPercent, formatDate } from "@/lib/data";
import { PnLCard, StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  DollarSign,
  BarChart3
} from "lucide-react";

export const dynamic = 'force-dynamic';

async function DailyPnLChart({ dailyResults }: { dailyResults: Array<{ date: string; pnl: number; wins: number; losses: number }> }) {
  const maxPnl = Math.max(...dailyResults.map(d => Math.abs(d.pnl)));
  
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Daily Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-32">
          {dailyResults.map((day, i) => {
            const height = maxPnl > 0 ? (Math.abs(day.pnl) / maxPnl) * 100 : 0;
            const isPositive = day.pnl >= 0;
            
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center justify-end h-24">
                  <div 
                    className={`w-full max-w-12 rounded-t-md transition-all duration-500 ${
                      isPositive ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ 
                      height: `${Math.max(height, 4)}%`,
                      animationDelay: `${i * 100}ms`
                    }}
                  />
                </div>
                <div className="text-center">
                  <div className={`text-xs font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(day.pnl)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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

async function RecentTrades({ trades }: { trades: Array<any> }) {
  const recentTrades = trades.slice(-5).reverse();
  
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Recent Trades</CardTitle>
        <a href="/trades" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          View all →
        </a>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentTrades.map((trade, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-3">
                <Badge 
                  variant={trade.direction === 'LONG' ? 'default' : 'secondary'}
                  className={trade.direction === 'LONG' 
                    ? 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30' 
                    : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                  }
                >
                  {trade.direction}
                </Badge>
                <div>
                  <div className="font-medium">{trade.symbol}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(trade.date)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${trade.pnl.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatCurrency(trade.pnl.total_pnl)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {trade.entry_price.toFixed(2)} → {trade.stopped ? 'Stopped' : 'Target'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function Dashboard() {
  const data = await getBacktestData();
  const { summary, daily_results, trades } = data;
  
  // Calculate today's P&L (most recent day)
  const todayResult = daily_results[daily_results.length - 1];
  const todayPnL = todayResult?.pnl || 0;
  
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Meridian Trading System Performance
          </p>
        </div>

        {/* Main P&L Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PnLCard 
            value={summary.total_pnl} 
            title="Total P&L"
            subtitle={`${summary.total_trades} trades • ${formatPercent(summary.total_return_pct)} return`}
          />
          <PnLCard 
            value={todayPnL} 
            title="Latest Day P&L"
            subtitle={todayResult ? formatDate(todayResult.date) : 'No data'}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard 
            title="Win Rate" 
            value={`${summary.win_rate.toFixed(1)}%`}
            trend={summary.win_rate >= 50 ? 'up' : 'down'}
            icon={<Target className="h-4 w-4" />}
          />
          <StatsCard 
            title="Profit Factor" 
            value={summary.profit_factor.toFixed(2)}
            trend={summary.profit_factor >= 1 ? 'up' : 'down'}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <StatsCard 
            title="Avg Win" 
            value={formatCurrency(summary.avg_win)}
            trend="up"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatsCard 
            title="Avg Loss" 
            value={formatCurrency(summary.avg_loss)}
            trend="down"
            icon={<TrendingDown className="h-4 w-4" />}
          />
        </div>

        {/* Win/Loss Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard 
            title="Total Trades" 
            value={summary.total_trades.toString()}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatsCard 
            title="Wins" 
            value={summary.wins.toString()}
            trend="up"
            subtitle={`${((summary.wins / summary.total_trades) * 100).toFixed(0)}% of trades`}
          />
          <StatsCard 
            title="Losses" 
            value={summary.losses.toString()}
            trend="down"
            subtitle={`${((summary.losses / summary.total_trades) * 100).toFixed(0)}% of trades`}
          />
          <StatsCard 
            title="Total Return" 
            value={formatPercent(summary.total_return_pct)}
            trend={summary.total_return_pct >= 0 ? 'up' : 'down'}
            icon={<DollarSign className="h-4 w-4" />}
          />
        </div>

        {/* Daily Performance Chart */}
        <DailyPnLChart dailyResults={daily_results} />

        {/* Recent Trades */}
        <RecentTrades trades={trades} />
      </div>
    </div>
  );
}
