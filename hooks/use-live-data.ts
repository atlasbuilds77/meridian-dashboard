'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'error';
  systems: {
    meridian: { name: string; status: 'online' | 'degraded' | 'offline'; lastUpdate: string | null };
    helios: { name: string; status: 'online' | 'degraded' | 'offline'; lastUpdate: string | null };
    nebula: { name: string; status: 'online' | 'degraded' | 'offline'; lastUpdate: string | null };
  };
  timestamp: string;
}

export interface TradeData {
  trades: Record<string, unknown>[];
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

type Listener = () => void;

type CacheEntry<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  listeners: Set<Listener>;
  inFlight: Promise<void> | null;
  intervalId: ReturnType<typeof setInterval> | null;
  refCount: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

function createEntry<T>(): CacheEntry<T> {
  return {
    data: null,
    loading: true,
    error: null,
    lastUpdate: null,
    listeners: new Set<Listener>(),
    inFlight: null,
    intervalId: null,
    refCount: 0,
  };
}

function getEntry<T>(cacheKey: string): CacheEntry<T> {
  if (!cacheStore.has(cacheKey)) {
    cacheStore.set(cacheKey, createEntry<T>());
  }
  return cacheStore.get(cacheKey) as CacheEntry<T>;
}

function notify(entry: CacheEntry<unknown>): void {
  entry.listeners.forEach((listener) => listener());
}

async function fetchEntry<T>(endpoint: string, entry: CacheEntry<T>): Promise<void> {
  if (entry.inFlight) {
    return entry.inFlight;
  }

  const task = (async () => {
    entry.loading = entry.data === null;
    notify(entry as CacheEntry<unknown>);

    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = (await response.json()) as T;
      entry.data = result;
      entry.error = null;
      entry.lastUpdate = new Date();
    } catch (error) {
      entry.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      entry.loading = false;
      entry.inFlight = null;
      notify(entry as CacheEntry<unknown>);
    }
  })();

  entry.inFlight = task;
  return task;
}

export function useLiveData<T>(endpoint: string, refreshInterval = 30_000) {
  const cacheKey = useMemo(() => `${endpoint}::${refreshInterval}`, [endpoint, refreshInterval]);
  const [, forceRerender] = useState(0);

  const refetch = useCallback(async () => {
    const currentEntry = getEntry<T>(cacheKey);
    await fetchEntry(endpoint, currentEntry);
  }, [cacheKey, endpoint]);

  useEffect(() => {
    const entry = getEntry<T>(cacheKey);

    const listener: Listener = () => {
      forceRerender((value) => value + 1);
    };

    entry.listeners.add(listener);
    entry.refCount += 1;

    if (!entry.intervalId) {
      entry.intervalId = setInterval(() => {
        void fetchEntry(endpoint, entry);
      }, refreshInterval);
    }

    if (entry.data === null && !entry.inFlight) {
      void fetchEntry(endpoint, entry);
    }

    return () => {
      entry.listeners.delete(listener);
      entry.refCount = Math.max(0, entry.refCount - 1);

      if (entry.refCount === 0 && entry.intervalId) {
        clearInterval(entry.intervalId);
        entry.intervalId = null;
      }
    };
  }, [cacheKey, endpoint, refreshInterval]);

  const currentEntry = getEntry<T>(cacheKey);

  return {
    data: currentEntry.data,
    loading: currentEntry.loading,
    error: currentEntry.error,
    lastUpdate: currentEntry.lastUpdate,
    refetch,
  };
}

export function useSystemStatus() {
  return useLiveData<SystemStatus>('/api/status', 30_000);
}

export function useTradeData() {
  return useLiveData<TradeData>('/api/user/trades?limit=100', 30_000);
}

export function useMarketData(symbol = 'QQQ') {
  return useLiveData<MarketData>(`/api/market?symbol=${symbol}`, 30_000);
}

export function useAccountData() {
  return useLiveData<AccountData>('/api/user/accounts', 60_000);
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
  }>('/api/user/stats', 30_000);
}
