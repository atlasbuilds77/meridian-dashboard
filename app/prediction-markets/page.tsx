'use client';

import { useLiveData } from '@/hooks/use-live-data';
import { PredictionMarketCard } from '@/components/prediction-market-card';
import { SignalFeed } from '@/components/signal-feed';
import { WalletConnection } from '@/components/wallet-connection';
import { PolymarketSetupGuide } from '@/components/polymarket-setup-guide';
import { UserPnLCard } from '@/components/user-pnl-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Eye,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Activity,
} from 'lucide-react';

interface OracleResponse {
  status: 'online' | 'stopped' | 'offline' | 'unknown';
  name: string;
  description: string;
  stats: {
    total_trades: number;
    wins: number;
    losses: number;
    pending: number;
    total_invested: number;
    total_returned: number;
    total_profit: number;
    win_rate: number;
  } | null;
  recentTrades: Array<{
    id: number;
    timestamp: string;
    asset: string;
    direction: string;
    market_type: string;
    shares: number;
    entry_price: number;
    cost: number;
    edge: number;
    model_prob: number;
    outcome: string;
    payout: number;
    profit: number;
  }>;
}

interface NightWatchResponse {
  status: 'online' | 'stopped' | 'offline' | 'unknown' | 'error';
  name: string;
  description: string;
  stats: {
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    totalStaked: number;
    openPositions: number;
    openPnL: number;
  } | null;
  recentTrades: Array<{
    id: string;
    market_id: string;
    side: string;
    price: number;
    size: number;
    stake_usd: number;
    status: string;
    dry_run: number;
    created_at: string;
  }>;
  openPositions: Array<{
    market_id: string;
    direction: string;
    entry_price: number;
    current_price: number;
    pnl: number;
    question: string;
    market_type: string;
    stake_usd: number;
  }>;
}

function CombinedPnLHeader({ oracle, nightwatch }: { oracle: OracleResponse | null; nightwatch: NightWatchResponse | null }) {
  const oracleProfit = oracle?.stats?.total_profit || 0;
  const nightwatchPnL = nightwatch?.stats?.openPnL || 0;
  const totalPnL = oracleProfit + nightwatchPnL;
  const isPositive = totalPnL >= 0;

  const totalTrades = (oracle?.stats?.total_trades || 0) + (nightwatch?.stats?.totalTrades || 0);
  const oracleOnline = oracle?.status === 'online';
  const nightwatchOnline = nightwatch?.status === 'online';
  const botsOnline = (oracleOnline ? 1 : 0) + (nightwatchOnline ? 1 : 0);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/35 bg-[rgba(19,19,28,0.78)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Prediction Markets</p>
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
              BETA
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs text-muted-foreground">
              <div className={`h-2 w-2 rounded-full ${botsOnline > 0 ? 'bg-profit animate-pulse' : 'bg-loss'}`} />
              <span>{botsOnline}/2 Bots Active</span>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <h1 className={`text-4xl font-bold tracking-tight sm:text-5xl ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {isPositive ? '+' : ''}${Math.abs(totalPnL).toFixed(2)}
          </h1>
          <span className="mb-1 text-sm text-muted-foreground">combined P&L</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>{totalTrades} total trades</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Oracle: <strong className={oracleOnline ? 'text-profit' : 'text-loss'}>{oracle?.status || 'unknown'}</strong></span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/8 px-3 py-2 text-sm text-muted-foreground">
            <Eye className="h-3.5 w-3.5 text-blue-500" />
            <span>NightWatch: <strong className={nightwatchOnline ? 'text-profit' : 'text-loss'}>{nightwatch?.status || 'unknown'}</strong></span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BetaNotice() {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-foreground">Beta Access — Limited to 3-4 Users</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Prediction market copy-trading is in active development. Oracle handles crypto predictions (BTC/ETH),
              while NightWatch covers event markets (politics, sports, world events). Connect your Polymarket wallet
              below to get started.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityNote() {
  return (
    <Card className="border-border/50 bg-secondary/25">
      <CardContent className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-background/60 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              How Copy-Trading Works
            </h4>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>• Oracle &amp; NightWatch generate signals from AI analysis</li>
              <li>• Trades are executed on your Polymarket wallet</li>
              <li>• Position sizing follows risk management rules</li>
              <li>• All trades visible in the Signal Feed</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/60 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              Bot Strategies
            </h4>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>• <strong className="text-amber-500">Oracle:</strong> Short-term crypto price predictions (5-60min)</li>
              <li>• <strong className="text-blue-500">NightWatch:</strong> Event-driven markets (elections, sports, macro)</li>
              <li>• Both bots run 24/7 with automated risk controls</li>
              <li>• Paper trading mode available for testing</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PredictionMarketsPage() {
  const { data: oracle, loading: oracleLoading } = useLiveData<OracleResponse>('/api/prediction-markets/oracle', 30_000);
  const { data: nightwatch, loading: nightwatchLoading } = useLiveData<NightWatchResponse>('/api/prediction-markets/nightwatch', 30_000);

  const loading = oracleLoading || nightwatchLoading;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Polymarket Integration</p>
          <h1 className="text-3xl font-bold tracking-tight nebula-gradient-text">Prediction Markets</h1>
        </header>

        {/* Combined P&L Header */}
        <CombinedPnLHeader oracle={oracle} nightwatch={nightwatch} />

        {/* Beta Notice */}
        <BetaNotice />

        {/* Bot Status Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <PredictionMarketCard
            name={oracle?.name || 'Oracle'}
            description={oracle?.description || 'Crypto prediction bot'}
            status={oracle?.status || 'unknown'}
            stats={oracle?.stats || null}
            variant="oracle"
            loading={loading && !oracle}
          />
          <PredictionMarketCard
            name={nightwatch?.name || 'NightWatch'}
            description={nightwatch?.description || 'Event prediction bot'}
            status={nightwatch?.status || 'unknown'}
            stats={nightwatch?.stats || null}
            variant="nightwatch"
            loading={loading && !nightwatch}
          />
        </div>

        {/* Wallet Connection */}
        <WalletConnection />

        {/* User's Copy-Trade P&L */}
        <UserPnLCard />

        {/* Signal Feeds - Separate sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Oracle Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Oracle Signals</h2>
              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px]">CRYPTO</Badge>
            </div>
            <SignalFeed
              oracleTrades={oracle?.recentTrades || []}
              nightwatchTrades={[]}
              nightwatchPositions={[]}
              loading={loading && !oracle}
              variant="oracle"
            />
          </div>

          {/* NightWatch Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">NightWatch Signals</h2>
              <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-[10px]">EVENTS</Badge>
            </div>
            <SignalFeed
              oracleTrades={[]}
              nightwatchTrades={nightwatch?.recentTrades || []}
              nightwatchPositions={nightwatch?.openPositions || []}
              loading={loading && !nightwatch}
              variant="nightwatch"
            />
          </div>
        </div>

        {/* Setup Guide */}
        <PolymarketSetupGuide />

        {/* Security & Info */}
        <SecurityNote />
      </div>
    </div>
  );
}
