'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatsCard } from '@/components/stats-card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTradeData } from '@/hooks/use-live-data';
import { formatCurrency, formatPercent } from '@/lib/utils-client';
import { StatsCardSkeleton, TableRowSkeleton } from '@/components/skeletons';

// Commission rate: $2.06/contract × 2 legs = $4.12/round trip
const COMMISSION_PER_ROUND_TRIP = 4.12;

type Trade = {
  id?: number;
  symbol: string;
  direction: string;
  asset_type: string;
  quantity: number;
  entry_price: number;
  exit_price?: number | null;
  strike?: number | null;
  expiry?: string | null;
  entry_date: string;
  exit_date?: string | null;
  created_at?: string;
  status: string;
  pnl?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  entry_reasoning?: string | null;
  setup_type?: string | null;
  notes?: string | null;
};

function parseNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number.parseFloat(String(value)) || 0;
}

function isBullish(direction: string): boolean {
  const normalized = direction.toUpperCase();
  return normalized === 'LONG' || normalized === 'CALL' || normalized === 'BULL';
}

function calculateGrossPnL(trade: Trade): number {
  if (trade.pnl !== null && trade.pnl !== undefined) {
    return parseNumber(trade.pnl);
  }

  if (trade.exit_price === null || trade.exit_price === undefined) {
    return 0;
  }

  const multiplier = trade.asset_type === 'option' || trade.asset_type === 'future' ? 100 : 1;
  const entry = parseNumber(trade.entry_price);
  const exit = parseNumber(trade.exit_price);

  return isBullish(trade.direction)
    ? (exit - entry) * trade.quantity * multiplier
    : (entry - exit) * trade.quantity * multiplier;
}

function calculateCommission(trade: Trade): number {
  // Commission applies per contract for options
  if (trade.asset_type === 'option') {
    return COMMISSION_PER_ROUND_TRIP * trade.quantity;
  }
  return 0;
}

function calculateNetPnL(trade: Trade): number {
  return calculateGrossPnL(trade) - calculateCommission(trade);
}

export default function TradesPage() {
  const { data, loading } = useTradeData();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  if (loading || !data) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted/30 rounded w-48 mb-2" />
            <div className="h-4 bg-muted/30 rounded w-64" />
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </div>

          <Card className="border-primary/30">
            <CardHeader>
              <div className="animate-pulse h-6 w-32 bg-muted/30 rounded" />
            </CardHeader>
            <CardContent className="p-0">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <TableRowSkeleton key={item} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const trades = (data.trades as Trade[]).map((trade) => ({
    ...trade,
    direction: trade.direction.toUpperCase(),
  }));

  const sortedTrades = [...trades].sort(
    (a, b) =>
      new Date(b.entry_date || b.created_at || '').getTime() -
      new Date(a.entry_date || a.created_at || '').getTime()
  );

  const bullishTrades = trades.filter((trade) => isBullish(trade.direction));
  const bearishTrades = trades.filter((trade) => !isBullish(trade.direction));

  const bullishWinRate =
    bullishTrades.length > 0
      ? (bullishTrades.filter((trade) => calculateNetPnL(trade) > 0).length / bullishTrades.length) * 100
      : 0;

  const bearishWinRate =
    bearishTrades.length > 0
      ? (bearishTrades.filter((trade) => calculateNetPnL(trade) > 0).length / bearishTrades.length) * 100
      : 0;

  const bestTrade = trades.length > 0 ? Math.max(...trades.map((trade) => calculateNetPnL(trade))) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map((trade) => calculateNetPnL(trade))) : 0;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight nebula-gradient-text">Trade History</h1>
            <p className="text-muted-foreground">All Meridian system trades with detailed P&L breakdown (including commissions)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard title="Bullish Trades" value={bullishTrades.length.toString()} subtitle={`${bullishWinRate.toFixed(0)}% win rate`} />
          <StatsCard title="Bearish Trades" value={bearishTrades.length.toString()} subtitle={`${bearishWinRate.toFixed(0)}% win rate`} />
          <StatsCard title="Best Trade" value={formatCurrency(bestTrade)} trend="up" />
          <StatsCard title="Worst Trade" value={formatCurrency(worstTrade)} trend="down" />
        </div>

        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">All Trades</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {trades.length} total
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-20 backdrop-blur-md bg-background/95 border-b border-primary/20">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 bg-background/95">Date</TableHead>
                    <TableHead className="sticky top-0 bg-background/95">Symbol</TableHead>
                    <TableHead className="sticky top-0 bg-background/95">Strike</TableHead>
                    <TableHead className="sticky top-0 bg-background/95">Expiry</TableHead>
                    <TableHead className="sticky top-0 bg-background/95">Direction</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background/95">Entry</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background/95">Exit</TableHead>
                    <TableHead className="text-center sticky top-0 bg-background/95">Status</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background/95">Gross P&L</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background/95">Comm.</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background/95">Net P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        No trades yet. Trades will appear here when Meridian executes them.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTrades.map((trade, index) => {
                      const grossPnl = calculateGrossPnL(trade);
                      const commission = calculateCommission(trade);
                      const netPnl = calculateNetPnL(trade);
                      const isWin = netPnl > 0;
                      const bullish = isBullish(trade.direction);

                      return (
                        <TableRow
                          key={trade.id || `${trade.entry_date}-${trade.symbol}-${index}`}
                          className="group hover:bg-secondary/30 cursor-pointer"
                          title={trade.entry_reasoning || 'Click to view details'}
                          onClick={() => setSelectedTrade(trade)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{new Date(trade.entry_date).toLocaleDateString()}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(trade.entry_date).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{trade.symbol}</span>
                          </TableCell>
                          <TableCell>
                            {trade.strike ? `$${parseNumber(trade.strike).toFixed(0)}` : '—'}
                          </TableCell>
                          <TableCell>
                            {trade.expiry 
                              ? new Date(trade.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {bullish ? (
                                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4 text-red-500" />
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  bullish
                                    ? 'border-emerald-500/50 text-emerald-500'
                                    : 'border-red-500/50 text-red-500'
                                }
                              >
                                {trade.direction}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${parseNumber(trade.entry_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {trade.exit_price !== undefined && trade.exit_price !== null
                              ? `$${parseNumber(trade.exit_price).toFixed(2)}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={
                                trade.status === 'closed'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }
                            >
                              {trade.status}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-semibold ${
                              grossPnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {formatCurrency(grossPnl)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-500">
                            {commission > 0 ? `-${formatCurrency(commission)}` : '—'}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-bold ${
                              isWin ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {formatCurrency(netPnl)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade Detail Modal */}
      <Dialog open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTrade && (
                <>
                  <span className="font-bold">{selectedTrade.symbol}</span>
                  <Badge
                    variant="outline"
                    className={isBullish(selectedTrade.direction) 
                      ? 'border-emerald-500/50 text-emerald-500' 
                      : 'border-red-500/50 text-red-500'}
                  >
                    {selectedTrade.direction}
                  </Badge>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTrade && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Entry Date</div>
                  <div className="font-medium">
                    {new Date(selectedTrade.entry_date).toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Exit Date</div>
                  <div className="font-medium">
                    {selectedTrade.exit_date 
                      ? new Date(selectedTrade.exit_date).toLocaleString()
                      : 'Open'}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Strike Price</div>
                  <div className="font-medium">
                    {selectedTrade.strike ? `$${parseNumber(selectedTrade.strike).toFixed(2)}` : 'N/A'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Expiry</div>
                  <div className="font-medium">
                    {selectedTrade.expiry 
                      ? new Date(selectedTrade.expiry).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Entry Price</div>
                  <div className="font-medium">
                    ${parseNumber(selectedTrade.entry_price).toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Exit Price</div>
                  <div className="font-medium">
                    {selectedTrade.exit_price 
                      ? `$${parseNumber(selectedTrade.exit_price).toFixed(2)}`
                      : 'Open'}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Quantity</div>
                  <div className="font-medium">
                    {selectedTrade.quantity} contract{selectedTrade.quantity !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Asset Type</div>
                  <div className="font-medium capitalize">
                    {selectedTrade.asset_type}
                  </div>
                </div>

                {selectedTrade.stop_loss && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Stop Loss</div>
                    <div className="font-medium text-red-500">
                      ${parseNumber(selectedTrade.stop_loss).toFixed(2)}
                    </div>
                  </div>
                )}
                {selectedTrade.take_profit && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Take Profit</div>
                    <div className="font-medium text-emerald-500">
                      ${parseNumber(selectedTrade.take_profit).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
              
              {/* P&L Summary */}
              <div className="border-t border-border/40 pt-4">
                <div className="text-sm font-semibold mb-2">P&L Breakdown</div>
                <div className="space-y-2">
                  {(() => {
                    const grossPnL = calculateGrossPnL(selectedTrade);
                    const commission = calculateCommission(selectedTrade);
                    const netPnL = calculateNetPnL(selectedTrade);
                    
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Gross P&L</span>
                          <span className={`font-mono font-semibold ${grossPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatCurrency(grossPnL)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            Commissions {commission > 0 ? `(${selectedTrade.quantity} × $4.12)` : ''}
                          </span>
                          <span className="font-mono text-red-500">
                            {commission > 0 ? `-${formatCurrency(commission)}` : '$0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border/40">
                          <span className="font-semibold">Net P&L</span>
                          <span className={`font-mono font-bold text-lg ${netPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatCurrency(netPnL)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              {/* Entry Reasoning */}
              {selectedTrade.entry_reasoning && (
                <div className="border-t border-border/40 pt-4">
                  <div className="text-sm font-semibold mb-2">Entry Reasoning</div>
                  <p className="text-sm text-muted-foreground">{selectedTrade.entry_reasoning}</p>
                </div>
              )}
              
              {/* Notes */}
              {selectedTrade.notes && (
                <div className="border-t border-border/40 pt-4">
                  <div className="text-sm font-semibold mb-2">Notes</div>
                  <p className="text-sm text-muted-foreground">{selectedTrade.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
