'use client';

import { Match } from '@/lib/types';
import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ActivityChartProps {
  matches: Match[];
}

export default function ActivityChart({ matches }: ActivityChartProps) {
  const chartData = useMemo(() => {
    if (matches.length === 0) return [];

    // Get date range: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count matches per day
    const dayCounts: Record<string, number> = {};

    // Initialize all days with 0
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      dayCounts[key] = 0;
    }

    // Count actual matches
    matches.forEach((match) => {
      const date = new Date(match.createdAt);
      const key = date.toISOString().split('T')[0];
      if (dayCounts[key] !== undefined) {
        dayCounts[key]++;
      }
    });

    return Object.entries(dayCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        matches: count,
      }));
  }, [matches]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="text-text-muted text-sm">No activity data yet</p>
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="voltGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4FF00" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4FF00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#333' }}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#333' }}
          />
          <Tooltip
            contentStyle={{
              background: '#1e1e1e',
              border: '1px solid #333',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontFamily: 'Montserrat, sans-serif',
              color: '#f0f0f0',
            }}
            labelStyle={{ color: '#999', fontWeight: 600 }}
            itemStyle={{ color: '#D4FF00' }}
          />
          <Area
            type="monotone"
            dataKey="matches"
            stroke="#D4FF00"
            strokeWidth={2}
            fill="url(#voltGradient)"
            dot={{ fill: '#D4FF00', strokeWidth: 0, r: 3 }}
            activeDot={{ fill: '#D4FF00', strokeWidth: 2, stroke: '#121212', r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
