export interface Trade {
  symbol: string;
  date: string;
  direction: 'LONG' | 'SHORT';
  entry_time: string;
  entry_price: number;
  strike: number;
  option_entry: number;
  liquidity_grab: boolean;
  phase2_price: number | null;
  phase2_time: string | null;
  phase2_option: number | null;
  phase3_price: number | null;
  phase3_time: string | null;
  phase3_option: number | null;
  stopped: boolean;
  phase2_elapsed?: number;
  stop_price?: number;
  stop_time?: string;
  pnl: {
    phase2_pnl: number;
    phase3_pnl: number;
    total_pnl: number;
    phase2_pct: number;
    phase3_pct?: number;
    phase2_scale?: number;
    phase3_scale?: number;
    total_pct: number;
  };
}

export interface DailyResult {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
}

export interface TradingStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  total_pnl: number;
  total_return_pct: number;
}

export interface BacktestData {
  metadata: {
    dates: string[];
    symbols: string[];
    position_size: number;
  };
  summary: TradingStats;
  daily_results: DailyResult[];
  trades: Trade[];
}
