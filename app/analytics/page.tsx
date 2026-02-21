"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/stats-card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface DailyResult {
  date: string;
  pnl: number;
  wins: number;
  losses: number;
  trades: number;
}

interface TradingStats {
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

interface Trade {
  symbol: string;
  direction: string;
  pnl: { total_pnl: number };
}

export default function AnalyticsPage() {
  const [dailyResults, setDailyResults] = useState<DailyResult[]>([]);
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        setDailyResults(data.daily_results || []);
        setStats(data.summary || null);
        setTrades(data.trades || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }
  
  if (!stats || stats.total_trades === 0) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Deep dive into your trading performance
            </p>
          </div>
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">
                No trading data yet. Analytics will appear once Meridian executes trades.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate cumulative P&L
  let cumulative = 0;
  const cumulativeData = dailyResults.map((day) => {
    cumulative += day.pnl;
    return {
      date: new Date(day.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      pnl: day.pnl,
      cumulative,
      winRate: day.trades > 0 ? (day.wins / day.trades) * 100 : 0,
    };
  });

  // Calculate win rate trend
  let runningWins = 0;
  let runningTotal = 0;
  const winRateTrend = dailyResults.map((day) => {
    runningWins += day.wins;
    runningTotal += day.trades;
    return {
      date: new Date(day.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      winRate: runningTotal > 0 ? (runningWins / runningTotal) * 100 : 0,
    };
  });

  // Symbol breakdown
  const symbolData = trades.reduce((acc: any, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = { wins: 0, losses: 0, pnl: 0 };
    }
    if (trade.pnl.total_pnl > 0) {
      acc[trade.symbol].wins++;
    } else {
      acc[trade.symbol].losses++;
    }
    acc[trade.symbol].pnl += trade.pnl.total_pnl;
    return acc;
  }, {});

  const symbolChartData = Object.entries(symbolData).map(([symbol, data]: any) => ({
    name: symbol,
    pnl: data.pnl,
    wins: data.wins,
    losses: data.losses,
  }));

  // Direction breakdown
  const directionData = trades.reduce(
    (acc: any, trade) => {
      const dir = trade.direction;
      if (!acc[dir]) acc[dir] = { wins: 0, losses: 0, pnl: 0 };
      if (trade.pnl.total_pnl > 0) acc[dir].wins++;
      else acc[dir].losses++;
      acc[dir].pnl += trade.pnl.total_pnl;
      return acc;
    },
    {} as Record<string, { wins: number; losses: number; pnl: number }>
  );

  const pieData = [
    { name: "Wins", value: stats?.wins || 0, color: "#22c55e" },
    { name: "Losses", value: stats?.losses || 0, color: "#ef4444" },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Deep dive into your trading performance
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="Expected Value"
            value={`$${stats ? ((stats.avg_win * stats.win_rate / 100) + (stats.avg_loss * (100 - stats.win_rate) / 100)).toFixed(0) : 0}`}
            subtitle="Per trade expectancy"
          />
          <StatsCard
            title="Profit Factor"
            value={stats?.profit_factor.toFixed(2) || "0"}
            trend={stats && stats.profit_factor > 1 ? "up" : "down"}
            subtitle="Gross profit / Gross loss"
          />
          <StatsCard
            title="Avg Trade"
            value={`$${stats ? (stats.total_pnl / stats.total_trades).toFixed(0) : 0}`}
            trend={stats && stats.total_pnl > 0 ? "up" : "down"}
          />
          <StatsCard
            title="Total Return"
            value={`${stats?.total_return_pct.toFixed(0) || 0}%`}
            trend={stats && stats.total_return_pct > 0 ? "up" : "down"}
          />
        </div>

        {/* Cumulative P&L Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Cumulative P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [
                      `$${Number(value || 0).toLocaleString()}`,
                      "Cumulative P&L",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPnl)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily P&L Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Daily P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [
                      `$${Number(value || 0).toLocaleString()}`,
                      "Daily P&L",
                    ]}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {cumulativeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Win Rate Trend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Win Rate Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={winRateTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      stroke="#71717a"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#71717a"
                      fontSize={12}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [`${Number(value || 0).toFixed(1)}%`, "Win Rate"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="winRate"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Win/Loss Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm text-muted-foreground">
                    Wins ({stats?.wins || 0})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-muted-foreground">
                    Losses ({stats?.losses || 0})
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Symbol Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Performance by Symbol
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symbolChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    type="number"
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [`$${Number(value || 0).toLocaleString()}`, "P&L"]}
                  />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                    {symbolChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Direction Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(directionData).map(([direction, data]: any) => (
            <Card key={direction}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    {direction} Trades
                  </CardTitle>
                  <Badge
                    className={
                      data.pnl >= 0
                        ? "bg-emerald-500/20 text-emerald-500"
                        : "bg-red-500/20 text-red-500"
                    }
                  >
                    ${data.pnl.toLocaleString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">
                      {data.wins + data.losses}
                    </div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-500">
                      {data.wins}
                    </div>
                    <div className="text-xs text-muted-foreground">Wins</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {data.wins + data.losses > 0
                        ? ((data.wins / (data.wins + data.losses)) * 100).toFixed(0)
                        : 0}
                      %
                    </div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
