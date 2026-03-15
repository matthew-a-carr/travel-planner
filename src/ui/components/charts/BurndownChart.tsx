'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Currency } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';

type DataPoint = { date: string; amountPence: number };

type Props = {
  idealLine: DataPoint[];
  actualLine: DataPoint[];
  projectedLine: DataPoint[];
  currency: Currency;
};

/**
 * Merges ideal, actual, and projected lines into a single dataset keyed by date.
 * Recharts needs a flat array with all series as properties on each data point.
 */
function mergeLines(ideal: DataPoint[], actual: DataPoint[], projected: DataPoint[]) {
  const map = new Map<
    string,
    { date: string; ideal?: number; actual?: number; projected?: number }
  >();

  for (const p of ideal) {
    const entry = map.get(p.date) ?? { date: p.date };
    entry.ideal = p.amountPence;
    map.set(p.date, entry);
  }
  for (const p of actual) {
    const entry = map.get(p.date) ?? { date: p.date };
    entry.actual = p.amountPence;
    map.set(p.date, entry);
  }
  for (const p of projected) {
    const entry = map.get(p.date) ?? { date: p.date };
    entry.projected = p.amountPence;
    map.set(p.date, entry);
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function buildAccessibleSummary(
  actual: DataPoint[],
  projected: DataPoint[],
  currency: Currency,
): string {
  if (actual.length === 0) return 'No spending data available yet.';

  const latest = actual[actual.length - 1];
  const remaining = formatMoney({ amountPence: latest.amountPence, currency });
  const latestDate = formatDate(latest.date);

  const parts = [`Remaining budget ${remaining} as of ${latestDate}.`];

  if (projected.length > 0) {
    const final = projected[projected.length - 1];
    const projectedRemaining = formatMoney({ amountPence: final.amountPence, currency });
    parts.push(`Projected to end at ${projectedRemaining}.`);
  }

  return parts.join(' ');
}

export function BurndownChart({ idealLine, actualLine, projectedLine, currency }: Props) {
  if (idealLine.length === 0) return null;

  const merged = mergeLines(idealLine, actualLine, projectedLine);
  const summary = buildAccessibleSummary(actualLine, projectedLine, currency);

  return (
    <figure aria-label={`Budget burndown chart. ${summary}`}>
      <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Budget burndown
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={merged} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#71717a" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) =>
              formatMoney({ amountPence: v, currency }).replace(/\.00$/, '')
            }
            tick={{ fontSize: 11, fill: '#a1a1aa' }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) =>
              value != null ? formatMoney({ amountPence: value as number, currency }) : ''
            }
          />
          <Legend
            iconType="line"
            iconSize={12}
            formatter={(value) => (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{value}</span>
            )}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            name="Budget pace"
            stroke="#a1a1aa"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual spend"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="projected"
            name="Projected"
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
