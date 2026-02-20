import { BacktestData } from './types';
import fs from 'fs';
import path from 'path';

const DATA_PATH = '/Users/atlasbuilds/clawd/meridian-trader/backtest_results.json';

export async function getBacktestData(): Promise<BacktestData> {
  try {
    const data = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(data) as BacktestData;
  } catch (error) {
    console.error('Error reading backtest data:', error);
    // Return mock data if file not found
    return {
      metadata: {
        dates: [],
        symbols: ['QQQ', 'SPY'],
        position_size: 1000
      },
      summary: {
        total_trades: 0,
        wins: 0,
        losses: 0,
        win_rate: 0,
        avg_win: 0,
        avg_loss: 0,
        profit_factor: 0,
        total_pnl: 0,
        total_return_pct: 0
      },
      daily_results: [],
      trades: []
    };
  }
}

export function formatCurrency(value: number): string {
  const formatted = Math.abs(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return value < 0 ? `-${formatted}` : formatted;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
