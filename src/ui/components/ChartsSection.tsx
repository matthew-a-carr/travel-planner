'use client';

import { BudgetBreakdownChart } from './charts/BudgetBreakdownChart';
import { EstimatedVsActualChart } from './charts/EstimatedVsActualChart';
import { SpendByCategoryChart } from './charts/SpendByCategoryChart';

type BudgetSegment = { label: string; amountPence: number; fill: string };
type DestRow = { name: string; estimated: number; actual: number };
type CategoryRow = { category: string; amountPence: number };

type Props = {
  budgetBreakdown: BudgetSegment[];
  estimatedVsActual: DestRow[];
  spendByCategory: CategoryRow[];
};

export function ChartsSection({ budgetBreakdown, estimatedVsActual, spendByCategory }: Props) {
  const hasDestinations = estimatedVsActual.length > 0;
  const hasSpend = spendByCategory.length > 0;

  return (
    <section className="space-y-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Charts</h2>

      <BudgetBreakdownChart data={budgetBreakdown} />

      {hasDestinations && (
        <>
          <div className="border-t border-zinc-100 dark:border-zinc-800" />
          <EstimatedVsActualChart data={estimatedVsActual} />
        </>
      )}

      {hasSpend && (
        <>
          <div className="border-t border-zinc-100 dark:border-zinc-800" />
          <SpendByCategoryChart data={spendByCategory} />
        </>
      )}

      {!hasDestinations && !hasSpend && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Add destinations and record spend to see charts here.
        </p>
      )}
    </section>
  );
}
