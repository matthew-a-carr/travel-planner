'use client';

import { formatMoney } from '@/domain/trip/types';

type CategoryRow = {
  category: string;
  amountPence: number;
  percentage: number;
  count: number;
};

export function FixedCostCategoryBreakdown({ data }: { data: CategoryRow[] }) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Fixed costs by category
      </h3>
      <ul className="space-y-2">
        {data.map((row) => (
          <li key={row.category} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
              <span className="capitalize">{row.category}</span>
              <span className="text-xs text-zinc-400">({row.count})</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">{row.percentage}%</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100 w-20 text-right">
                {formatMoney({ amountPence: row.amountPence, currency: 'GBP' })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
