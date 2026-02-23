'use client';

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
import { StatsCard } from '@/components/stats-card';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTradeData } from '@/hooks/use-live-data';
import { formatCurrency, formatPercent } from '@/lib/utils-client';

type Trade = {
  id?: number;
  symbol: string;
  direction: string;
  asset_type: string;
  quantity: number;
  entry_price: number;
  exit_price?: number | null;
  entry_date: string;
  created_at?: string;
  status: string;
  pnl?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  entry_reasoning?: string | null;
  setup_type?: string | null;
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

function calculatePnL(trade: Trade): number {
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

export default function TradesPage() {
  const { data, loading } = useTradeData();

  if (loading || !data) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-64 bg-muted rounded" />
          </div>
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
      ? (bullishTrades.filter((trade) => calculatePnL(trade) > 0).length / bullishTrades.length) * 100
      : 0;

  const bearishWinRate =
    bearishTrades.length > 0
      ? (bearishTrades.filter((trade) => calculatePnL(trade) > 0).length / bearishTrades.length) * 100
      : 0;

  const bestTrade = trades.length > 0 ? Math.max(...trades.map((trade) => calculatePnL(trade))) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map((trade) => calculatePnL(trade))) : 0;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight nebula-gradient-text">Trade History</h1>
            <p className="text-muted-foreground">All Meridian system trades with detailed P&L breakdown</p>
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
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Setup</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">Stop</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Exit</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">Return %</TableHead>
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
                      const pnl = calculatePnL(trade);
                      const isWin = pnl > 0;
                      const bullish = isBullish(trade.direction);
                      const contractMultiplier =
                        trade.asset_type === 'option' || trade.asset_type === 'future' ? 100 : 1;
                      const costBasis = parseNumber(trade.entry_price) * trade.quantity * contractMultiplier;
                      const returnPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

                      return (
                        <TableRow
                          key={trade.id || `${trade.entry_date}-${trade.symbol}-${index}`}
                          className="group hover:bg-secondary/30"
                          title={trade.entry_reasoning || undefined}
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
                            <Badge variant="outline" className="text-xs">
                              {trade.setup_type || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{trade.symbol}</span>
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
                          <TableCell className="text-right font-mono text-red-500">
                            {trade.stop_loss !== undefined && trade.stop_loss !== null
                              ? `$${parseNumber(trade.stop_loss).toFixed(2)}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-500">
                            {trade.take_profit !== undefined && trade.take_profit !== null
                              ? `$${parseNumber(trade.take_profit).toFixed(2)}`
                              : '—'}
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
                              isWin ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {formatCurrency(pnl)}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${isWin ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatPercent(returnPct)}
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
    </div>
  );
}
