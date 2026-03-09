'use client';

import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
  /** Array of P&L values (one per day), oldest first */
  data: number[];
  /** Width of the sparkline container */
  width?: number;
  /** Height of the sparkline container */
  height?: number;
  /** Line color for positive trend (last value >= first value) */
  positiveColor?: string;
  /** Line color for negative trend */
  negativeColor?: string;
  className?: string;
}

/**
 * Minimal sparkline chart showing P&L trend.
 * No axes, no grid, no labels — just a clean line.
 */
export function Sparkline({
  data,
  width = 120,
  height = 40,
  positiveColor = '#22c55e',
  negativeColor = '#ef4444',
  className,
}: SparklineProps) {
  const chartData = useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data],
  );

  if (data.length < 2) return null;

  const isPositive = data[data.length - 1] >= data[0];
  const strokeColor = isPositive ? positiveColor : negativeColor;

  return (
    <div className={className} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
