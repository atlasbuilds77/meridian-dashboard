'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils-client';
import { SwipeableCard } from '@/components/swipeable-card';

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
}

interface MobileTradeCardProps {
  trade: Trade;
  grossPnL: number;
  commission: number;
  netPnL: number;
  onClick?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

function isBullish(direction: string): boolean {
  const d = direction.toUpperCase();
  return d === 'LONG' || d === 'CALL' || d === 'BUY';
}

export function MobileTradeCard({ trade, grossPnL, commission, netPnL, onClick, onDelete, onEdit }: MobileTradeCardProps) {
  const bullish = isBullish(trade.direction);
  const isWin = netPnL > 0;

  return (
    <SwipeableCard onDelete={onDelete} onEdit={onEdit}>
      <Card 
        className="border-primary/30 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={onClick}
      >
        <CardContent className="p-4">
        {/* Top row: Symbol + Direction + Net P&L */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{trade.symbol}</span>
            <Badge
              variant="outline"
              className={bullish ? 'border-profit/50 text-profit' : 'border-loss/50 text-loss'}
            >
              {bullish ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {trade.direction}
            </Badge>
          </div>
          <div className={`text-xl font-bold ${isWin ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(netPnL)}
          </div>
        </div>

        {/* Strike + Expiry row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
          {trade.strike && (
            <span>${trade.strike.toFixed(0)} strike</span>
          )}
          {trade.expiry && (
            <span>
              {new Date(trade.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span>{trade.quantity} contract{trade.quantity !== 1 ? 's' : ''}</span>
        </div>

        {/* Entry/Exit row */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Entry:</span>
            <span className="font-mono">${Number(trade.entry_price).toFixed(2)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-mono">
              {trade.exit_price ? `$${Number(trade.exit_price).toFixed(2)}` : 'Open'}
            </span>
          </div>
        </div>

        {/* P&L breakdown (collapsed by default, shows on tap) */}
        <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>Gross: {formatCurrency(grossPnL)}</span>
          {commission > 0 && <span>Comm: -{formatCurrency(commission)}</span>}
          <span>
            {new Date(trade.entry_date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </CardContent>
    </Card>
    </SwipeableCard>
  );
}
