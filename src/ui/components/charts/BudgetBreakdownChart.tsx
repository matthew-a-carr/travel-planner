'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoney } from '@/domain/trip/types';

type Segment = { label: string; amountPence: number; fill: string };

function penceToLabel(pence: number): string {
  return formatMoney({ amountPence: pence, currency: 'GBP' });
}

export function BudgetBreakdownChart({ data }: { data: Segment[] }) {
  const nonZero = data.filter((s) => s.amountPence > 0);
  if (nonZero.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-zinc-700">Budget breakdown</h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={nonZero}
              dataKey="amountPence"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
            >
              {nonZero.map((seg) => (
                <Cell key={seg.label} fill={seg.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => (value != null ? penceToLabel(value as number) : '')} />
          </PieChart>
        </ResponsiveContainer>

        <ul className="flex-1 space-y-1.5">
          {nonZero.map((seg) => (
            <li key={seg.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: seg.fill }}
                />
                {seg.label}
              </span>
              <span className="font-medium text-zinc-900">{penceToLabel(seg.amountPence)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
