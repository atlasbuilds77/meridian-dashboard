import { getBacktestData, formatCurrency, formatPercent, formatDate } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatsCard } from "@/components/stats-card";
import { ArrowUpRight, ArrowDownRight, Filter } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function TradesPage() {
  const data = await getBacktestData();
  const { trades, summary } = data;
  
  // Sort trades by date (newest first)
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate some additional stats
  const longTrades = trades.filter(t => t.direction === 'LONG');
  const shortTrades = trades.filter(t => t.direction === 'SHORT');
  const longWinRate = longTrades.length > 0 
    ? (longTrades.filter(t => t.pnl.total_pnl > 0).length / longTrades.length) * 100 
    : 0;
  const shortWinRate = shortTrades.length > 0 
    ? (shortTrades.filter(t => t.pnl.total_pnl > 0).length / shortTrades.length) * 100 
    : 0;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Trade History</h1>
            <p className="text-muted-foreground">
              All Meridian system trades with detailed P&L breakdown
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard 
            title="Long Trades" 
            value={longTrades.length.toString()}
            subtitle={`${longWinRate.toFixed(0)}% win rate`}
          />
          <StatsCard 
            title="Short Trades" 
            value={shortTrades.length.toString()}
            subtitle={`${shortWinRate.toFixed(0)}% win rate`}
          />
          <StatsCard 
            title="Best Trade" 
            value={formatCurrency(Math.max(...trades.map(t => t.pnl.total_pnl)))}
            trend="up"
          />
          <StatsCard 
            title="Worst Trade" 
            value={formatCurrency(Math.min(...trades.map(t => t.pnl.total_pnl)))}
            trend="down"
          />
        </div>

        {/* Trades Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">All Trades</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {trades.length} total
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">Strike</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">Return %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTrades.map((trade, i) => {
                    const isWin = trade.pnl.total_pnl > 0;
                    const isLong = trade.direction === 'LONG';
                    
                    return (
                      <TableRow 
                        key={`${trade.date}-${trade.symbol}-${i}`}
                        className="group hover:bg-secondary/30"
                      >
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{formatDate(trade.date)}</span>
                            <span className="text-xs text-muted-foreground">{trade.entry_time}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{trade.symbol}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {isLong ? (
                              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-500" />
                            )}
                            <Badge 
                              variant="outline"
                              className={isLong 
                                ? 'border-emerald-500/50 text-emerald-500' 
                                : 'border-red-500/50 text-red-500'
                              }
                            >
                              {trade.direction}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${trade.entry_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${trade.strike}
                        </TableCell>
                        <TableCell className="text-center">
                          {trade.stopped ? (
                            <Badge variant="destructive" className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                              Stopped
                            </Badge>
                          ) : trade.phase3_price ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                              Phase 3
                            </Badge>
                          ) : trade.phase2_price ? (
                            <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                              Phase 2
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Entry
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${isWin ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatCurrency(trade.pnl.total_pnl)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono text-sm ${isWin ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatPercent(trade.pnl.total_pct)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Trade Breakdown by Symbol */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.metadata.symbols.map(symbol => {
            const symbolTrades = trades.filter(t => t.symbol === symbol);
            const symbolPnL = symbolTrades.reduce((sum, t) => sum + t.pnl.total_pnl, 0);
            const symbolWins = symbolTrades.filter(t => t.pnl.total_pnl > 0).length;
            const symbolWinRate = symbolTrades.length > 0 ? (symbolWins / symbolTrades.length) * 100 : 0;
            
            return (
              <Card key={symbol} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold">{symbol}</CardTitle>
                    <Badge variant={symbolPnL >= 0 ? 'default' : 'destructive'} 
                      className={symbolPnL >= 0 
                        ? 'bg-emerald-500/20 text-emerald-500' 
                        : 'bg-red-500/20 text-red-500'
                      }
                    >
                      {formatCurrency(symbolPnL)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{symbolTrades.length}</div>
                      <div className="text-xs text-muted-foreground">Trades</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-500">{symbolWins}</div>
                      <div className="text-xs text-muted-foreground">Wins</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{symbolWinRate.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
