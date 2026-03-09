'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown, Receipt, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils-client';
import { MobileTradeCard } from '@/components/mobile-trade-card';

// Commission rate: Use actual commission from Tradier (most accounts are $0)
// Fallback to $0 if not provided - don't assume commissions
const DEFAULT_COMMISSION_PER_ROUND_TRIP = 0;
const MARKET_TIMEZONE = 'America/Los_Angeles';

interface Trade {
  id: number;
  symbol: string;
  direction: string;
  asset_type: string;
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  strike: number | null;
  expiry: string | null;
  entry_date: string;
  exit_date: string | null;
  pnl: number | null;
  gross_pnl?: number | null;
  commission?: number | null;
  net_pnl?: number | null;
  status: string;
  notes: string | null;
}

interface WeeklyBillingData {
  weekStart: string;
  weekEnd: string;
  trades: Trade[];
  grossPnL: number;
  commissions: number;
  netPnL: number;
  feeAmount: number;
  tradeCount: number;
}

function parseNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

function hasExplicitTradeBreakdown(trade: Trade): boolean {
  return trade.gross_pnl !== undefined || trade.commission !== undefined || trade.net_pnl !== undefined;
}

function calculateCommission(trade: Trade): number {
  // Use actual commission from trade data (from Tradier)
  // Don't assume commissions - most accounts show $0
  if (trade.commission !== null && trade.commission !== undefined) {
    return parseNumber(trade.commission);
  }

  // Only use default if no commission data available
  return DEFAULT_COMMISSION_PER_ROUND_TRIP * trade.quantity;
}

function calculateTradePnL(trade: Trade): number {
  if (trade.gross_pnl !== null && trade.gross_pnl !== undefined) {
    return parseNumber(trade.gross_pnl);
  }

  if (hasExplicitTradeBreakdown(trade)) {
    if (trade.net_pnl !== null && trade.net_pnl !== undefined) {
      return parseNumber(trade.net_pnl) + calculateCommission(trade);
    }
    if (trade.pnl !== null && trade.pnl !== undefined) {
      return parseNumber(trade.pnl) + calculateCommission(trade);
    }
  }

  if (trade.pnl !== null && trade.pnl !== undefined) {
    return parseNumber(trade.pnl);
  }

  if (!trade.exit_price) return 0;

  const multiplier = trade.asset_type === 'option' || trade.asset_type === 'future' ? 100 : 1;
  const directionMultiplier = ['SHORT', 'PUT'].includes(trade.direction.toUpperCase()) ? -1 : 1;

  return (parseNumber(trade.exit_price) - parseNumber(trade.entry_price)) *
         trade.quantity * multiplier * directionMultiplier;
}

function calculateNetPnL(trade: Trade): number {
  if (trade.net_pnl !== null && trade.net_pnl !== undefined) {
    return parseNumber(trade.net_pnl);
  }

  if (hasExplicitTradeBreakdown(trade) && trade.pnl !== null && trade.pnl !== undefined) {
    return parseNumber(trade.pnl);
  }

  return calculateTradePnL(trade) - calculateCommission(trade);
}

function formatDateForApi(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to format date for API');
  }

  return `${year}-${month}-${day}`;
}

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const isoDay = ((d.getDay() + 6) % 7) + 1; // Monday=1 ... Sunday=7

  // Monday = start of billing week, Friday = end.
  const monday = new Date(d);
  monday.setDate(d.getDate() - (isoDay - 1));
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  return { start: monday, end: friday };
}

function formatWeekRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function isBullish(direction: string): boolean {
  const d = direction.toUpperCase();
  return d === 'LONG' || d === 'CALL' || d === 'BUY';
}

export function WeeklyBillingView() {
  const [weeklyData, setWeeklyData] = useState<WeeklyBillingData | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const { start: weekStart, end: weekEnd } = getWeekBounds(currentWeek);

  const fetchWeeklyTrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const startStr = formatDateForApi(weekStart);
      const endStr = formatDateForApi(weekEnd);

      const res = await fetch(`/api/user/trades/weekly?start=${startStr}&end=${endStr}&_t=${Date.now()}`, {
        cache: 'no-store',
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch weekly trades');
      }
      
      const data = await res.json();
      setWeeklyData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void fetchWeeklyTrades();
  }, [fetchWeeklyTrades]);

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    // Don't go beyond current week
    const now = new Date();
    if (newDate <= now) {
      setCurrentWeek(newDate);
    }
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  const isCurrentWeek = () => {
    const now = new Date();
    const { start } = getWeekBounds(now);
    return weekStart.getTime() === start.getTime();
  };

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <Card className="border-primary/30">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="h-5 w-5 text-primary" />
              Weekly Billing
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="min-w-[180px] text-center">
                <span className="font-semibold">
                  {formatWeekRange(weekStart, weekEnd)}
                </span>
                {isCurrentWeek() && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Current
                  </Badge>
                )}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                disabled={isCurrentWeek()}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              {!isCurrentWeek() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToCurrentWeek}
                  className="text-xs"
                >
                  Today
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      {weeklyData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" />
                Gross P&L
              </div>
              <div className={`text-2xl font-bold ${weeklyData.grossPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(weeklyData.grossPnL)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Receipt className="h-3 w-3" />
                Commissions
              </div>
              <div className="text-2xl font-bold text-loss">
                -{formatCurrency(weeklyData.commissions)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" />
                Net P&L
              </div>
              <div className={`text-2xl font-bold ${weeklyData.netPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(weeklyData.netPnL)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Receipt className="h-3 w-3" />
                Fee (10%)
              </div>
              <div className="text-2xl font-bold text-foreground">
                {weeklyData.feeAmount > 0 ? formatCurrency(weeklyData.feeAmount) : '$0.00'}
              </div>
              <div className="text-xs text-muted-foreground">
                {weeklyData.feeAmount > 0 ? 'Due Sunday 11:59 PM' : 'No fee (no net profit)'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trades Table */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Trades This Week</CardTitle>
            <Badge variant="secondary">
              {weeklyData?.tradeCount || 0} trades
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading trades...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-loss">
              {error}
            </div>
          ) : !weeklyData || weeklyData.trades.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No trades this week.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {weeklyData.trades.map((trade) => {
                  const grossPnL = calculateTradePnL(trade);
                  const commission = calculateCommission(trade);
                  const netPnL = calculateNetPnL(trade);
                  
                  return (
                    <MobileTradeCard
                      key={trade.id}
                      trade={trade}
                      grossPnL={grossPnL}
                      commission={commission}
                      netPnL={netPnL}
                      onClick={() => setSelectedTrade(trade)}
                    />
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Date</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Strike</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="text-right">Entry</TableHead>
                      <TableHead className="text-right">Exit</TableHead>
                      <TableHead className="text-right">Gross P&L</TableHead>
                      <TableHead className="text-right">Comm.</TableHead>
                      <TableHead className="text-right">Net P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyData.trades.map((trade) => {
                      const grossPnL = calculateTradePnL(trade);
                      const commission = calculateCommission(trade);
                      const netPnL = calculateNetPnL(trade);
                      const bullish = isBullish(trade.direction);
                      const isWin = netPnL > 0;

                      return (
                        <TableRow
                          key={trade.id}
                          className="cursor-pointer hover:bg-secondary/30"
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
                          <TableCell className="font-semibold">{trade.symbol}</TableCell>
                          <TableCell>
                            {trade.strike ? `$${trade.strike.toFixed(0)}` : '—'}
                          </TableCell>
                          <TableCell>
                            {trade.expiry 
                              ? new Date(trade.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '—'}
                          </TableCell>
                          <TableCell>
                          <div className="flex items-center gap-1">
                            {bullish ? (
                              <TrendingUp className="h-4 w-4 text-profit" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-loss" />
                            )}
                            <Badge
                              variant="outline"
                              className={bullish ? 'border-profit/50 text-profit' : 'border-loss/50 text-loss'}
                            >
                              {trade.direction}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${parseNumber(trade.entry_price).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {trade.exit_price ? `$${parseNumber(trade.exit_price).toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${grossPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(grossPnL)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-loss">
                          -{formatCurrency(commission)}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${isWin ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(netPnL)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
                      ? 'border-profit/50 text-profit' 
                      : 'border-loss/50 text-loss'}
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
                    {selectedTrade.strike ? `$${selectedTrade.strike.toFixed(2)}` : 'N/A'}
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
              </div>
              
              {/* P&L Summary */}
              <div className="border-t border-border/40 pt-4">
                <div className="text-sm font-semibold mb-2">P&L Breakdown</div>
                <div className="space-y-2">
                  {(() => {
                    const grossPnL = calculateTradePnL(selectedTrade);
                    const commission = calculateCommission(selectedTrade);
                    const netPnL = calculateNetPnL(selectedTrade);
                    
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Gross P&L</span>
                          <span className={`font-mono font-semibold ${grossPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatCurrency(grossPnL)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            Commissions
                          </span>
                          <span className="font-mono text-loss">
                            -{formatCurrency(commission)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border/40">
                          <span className="font-semibold">Net P&L</span>
                          <span className={`font-mono font-bold text-lg ${netPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatCurrency(netPnL)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              
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
