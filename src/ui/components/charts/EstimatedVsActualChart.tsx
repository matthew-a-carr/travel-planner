'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/domain/trip/types';

type Row = { name: string; estimated: number; actual: number };

function penceToLabel(pence: number): string {
  return formatMoney({ amountPence: pence, currency: 'GBP' });
}

export function EstimatedVsActualChart({ data }: { data: Row[] }) {
  if (data.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Estimated vs actual spend
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#71717a" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `£${Math.round(v / 100).toLocaleString()}`}
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip formatter={(value) => (value != null ? penceToLabel(value as number) : '')} />
          <Legend
            iconType="square"
            iconSize={10}
            formatter={(value) => (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{value}</span>
            )}
          />
          <Bar dataKey="estimated" name="Estimated" fill="#60a5fa" radius={[3, 3, 0, 0]} />
          <Bar dataKey="actual" name="Actual spend" fill="#2563eb" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
