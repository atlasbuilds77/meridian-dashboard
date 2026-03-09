'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartSkeleton } from '@/components/skeletons';

interface DailyPnl {
  date: string;
  pnl: number;
  trades: number;
}

interface DayCell {
  date: Date;
  dateStr: string;
  pnl: number;
  trades: number;
  hasData: boolean;
}

interface PnlHeatmapProps {
  /** Number of weeks to show (default: 12) */
  weeks?: number;
  /** Called when a day is clicked */
  onDayClick?: (date: string) => void;
}

const WEEKDAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getPnlColor(pnl: number, maxAbsPnl: number): string {
  if (pnl === 0) return 'bg-zinc-800/50';
  const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);

  if (pnl > 0) {
    if (intensity < 0.25) return 'bg-emerald-900/60';
    if (intensity < 0.5) return 'bg-emerald-700/70';
    if (intensity < 0.75) return 'bg-emerald-600/80';
    return 'bg-emerald-500';
  }
  if (intensity < 0.25) return 'bg-red-900/60';
  if (intensity < 0.5) return 'bg-red-700/70';
  if (intensity < 0.75) return 'bg-red-600/80';
  return 'bg-red-500';
}

function getNoDataColor(): string {
  return 'bg-zinc-800/30';
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PnlHeatmap({ weeks = 12, onDayClick }: PnlHeatmapProps) {
  const [dailyPnl, setDailyPnl] = useState<DailyPnl[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{
    day: DayCell;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/user/daily-pnl');
        if (res.ok) {
          const data = await res.json();
          setDailyPnl(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch daily P&L:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const { grid, monthLabels, maxAbsPnl } = useMemo(() => {
    // Build a lookup map from date string -> daily data
    const pnlMap = new Map<string, DailyPnl>();
    for (const d of dailyPnl) {
      pnlMap.set(d.date, d);
    }

    // Calculate grid: last N weeks, ending today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the start: go back (weeks * 7) days, then align to Sunday
    const totalDays = weeks * 7;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);
    // Align to the previous Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const days: DayCell[] = [];
    const current = new Date(startDate);
    let mAbsPnl = 0;

    while (current <= today) {
      const dateStr = current.toISOString().split('T')[0];
      const data = pnlMap.get(dateStr);
      const pnl = data?.pnl ?? 0;
      const trades = data?.trades ?? 0;
      const hasData = !!data;

      if (hasData && Math.abs(pnl) > mAbsPnl) {
        mAbsPnl = Math.abs(pnl);
      }

      days.push({
        date: new Date(current),
        dateStr,
        pnl,
        trades,
        hasData,
      });

      current.setDate(current.getDate() + 1);
    }

    // Organize into columns (weeks) for CSS grid
    // Grid: 7 rows (Sun-Sat) x N columns (weeks)
    const columns: DayCell[][] = [];
    let currentWeek: DayCell[] = [];
    for (const day of days) {
      if (day.date.getDay() === 0 && currentWeek.length > 0) {
        columns.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) {
      columns.push(currentWeek);
    }

    // Month labels: find where each month starts in the columns
    const mLabels: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;
    for (let col = 0; col < columns.length; col++) {
      // Check the first day of the week (Sunday)
      const firstDay = columns[col][0];
      const month = firstDay.date.getMonth();
      if (month !== lastMonth) {
        mLabels.push({
          label: MONTH_NAMES[month],
          colIndex: col,
        });
        lastMonth = month;
      }
    }

    return {
      grid: columns,
      monthLabels: mLabels,
      maxAbsPnl: mAbsPnl || 1, // avoid division by zero
    };
  }, [dailyPnl, weeks]);

  function handleMouseEnter(day: DayCell, e: React.MouseEvent) {
    if (!day.hasData) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      day,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  function handleClick(day: DayCell) {
    if (day.hasData && onDayClick) {
      onDayClick(day.dateStr);
    }
  }

  if (loading) {
    return <ChartSkeleton />;
  }

  return (
    <Card className="border-primary/30 bg-[rgba(19,19,28,0.72)] hover:border-primary/55 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">P&L Heatmap</CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-0.5">
              <div className="w-2.5 h-2.5 rounded-[3px] bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-[3px] bg-red-700/70" />
              <div className="w-2.5 h-2.5 rounded-[3px] bg-zinc-800/30" />
              <div className="w-2.5 h-2.5 rounded-[3px] bg-emerald-700/70" />
              <div className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500" />
            </div>
            <span>More</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Month labels row */}
          <div className="flex">
            {/* Spacer for weekday labels */}
            <div className="w-6 shrink-0" />
            <div className="relative flex-1" style={{ minWidth: grid.length * 16 }}>
              {monthLabels.map((m) => (
                <span
                  key={`${m.label}-${m.colIndex}`}
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: m.colIndex * 16 }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex mt-4">
            {/* Weekday labels */}
            <div className="flex flex-col shrink-0 w-6">
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="h-[14px] flex items-center text-[10px] text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Heatmap squares */}
            <div className="flex gap-[2px]">
              {grid.map((week, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-[2px]">
                  {/* Pad leading empty slots for partial first week */}
                  {colIdx === 0 &&
                    Array.from({ length: week[0].date.getDay() }).map((_, i) => (
                      <div key={`pad-${i}`} className="w-[12px] h-[12px]" />
                    ))}
                  {week.map((day) => (
                    <div
                      key={day.dateStr}
                      className={`w-[12px] h-[12px] rounded-[3px] transition-all duration-150 ${
                        day.hasData
                          ? `${getPnlColor(day.pnl, maxAbsPnl)} hover:ring-1 hover:ring-white/40 cursor-pointer`
                          : `${getNoDataColor()} cursor-default`
                      }`}
                      onMouseEnter={(e) => handleMouseEnter(day, e)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleClick(day)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
              <div className="text-xs text-muted-foreground">
                {formatDate(tooltip.day.date)}
              </div>
              <div
                className={`text-sm font-semibold ${
                  tooltip.day.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(tooltip.day.pnl)}
              </div>
              <div className="text-xs text-muted-foreground">
                {tooltip.day.trades} trade{tooltip.day.trades !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
