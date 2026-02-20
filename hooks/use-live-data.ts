'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'error';
  systems: {
    meridian: { name: string; status: string; lastUpdate: string | null };
    helios: { name: string; status: string; lastUpdate: string | null };
    nebula: { name: string; status: string; lastUpdate: string | null };
  };
  timestamp: string;
}

export interface TradeData {
  trades: any[];
  summary: {
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    winRate: number;
    profitFactor: number;
  };
  timestamp: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface AccountData {
  accounts: Array<{
    name: string;
    type: string;
    accountId: string;
    balance: number;
    currency: string;
  }>;
  totalBalance: number;
  timestamp: string;
}

export function useLiveData<T>(
  endpoint: string,
  refreshInterval: number = 30000 // 30 seconds
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error(`Error fetching ${endpoint}:`, err);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { data, loading, error, lastUpdate, refetch: fetchData };
}

export function useSystemStatus() {
  return useLiveData<SystemStatus>('/api/status', 30000);
}

export function useTradeData() {
  return useLiveData<TradeData>('/api/user/trades?limit=100', 30000);
}

export function useMarketData(symbol: string = 'QQQ') {
  return useLiveData<MarketData>(`/api/market?symbol=${symbol}`, 30000);
}

export function useAccountData() {
  return useLiveData<AccountData>('/api/user/accounts', 60000); // 1 minute
}

export function useUserStats() {
  return useLiveData<{
    totalAccounts: number;
    totalBalance: number;
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnL: number;
    winRate: number;
    timestamp: string;
  }>('/api/user/stats', 30000);
}
