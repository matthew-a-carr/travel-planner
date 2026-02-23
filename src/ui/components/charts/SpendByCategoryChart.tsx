'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney } from '@/domain/trip/types';

type Row = { category: string; amountPence: number };

const FILLS = ['#18181b', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7'];

function penceToLabel(pence: number): string {
  return formatMoney({ amountPence: pence, currency: 'GBP' });
}

export function SpendByCategoryChart({ data }: { data: Row[] }) {
  if (data.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-zinc-700">Spend by category</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amountPence"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((row, i) => (
              <Cell key={row.category} fill={FILLS[i % FILLS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) =>
              value != null ? [penceToLabel(value as number), name as string] : ['']
            }
          />
          <Legend
            iconType="square"
            iconSize={10}
            formatter={(value) => <span className="text-xs text-zinc-500 capitalize">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
