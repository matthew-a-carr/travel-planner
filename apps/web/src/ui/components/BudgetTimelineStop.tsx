'use client';

import type { Currency, WaterfallStop } from '@/domain/trip/types';
import { formatMoney, moneyUnchecked } from '@/domain/trip/types';

type Props = {
  stop: WaterfallStop;
  currency: Currency;
  isLast: boolean;
  isSelected: boolean;
  onClick: () => void;
};

export function BudgetTimelineStop({ stop, currency, isLast, isSelected, onClick }: Props) {
  const dotColor = stop.isOverBudget
    ? 'bg-red-500'
    : stop.type === 'fixed-costs'
      ? 'bg-amber-500'
      : 'bg-blue-500';

  const fmt = (pence: number) => formatMoney(moneyUnchecked(pence, currency));

  const isClickable = stop.destinationId !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`relative block w-full text-left ${isLast ? 'pb-0' : 'pb-6'} ${
        isSelected
          ? 'rounded-lg bg-blue-50 px-2 py-1 dark:bg-blue-950/40'
          : isClickable
            ? 'rounded-lg px-2 py-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            : 'px-2 py-1'
      }`}
    >
      <span
        className={`absolute -left-[31px] top-1 block h-3 w-3 rounded-full ${dotColor} ring-2 ${
          isSelected ? 'ring-blue-400 dark:ring-blue-500' : 'ring-white dark:ring-zinc-900'
        } ${isSelected ? 'scale-125' : ''} transition-transform`}
      />

      <span className="block">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {stop.label}
        </span>

        {stop.startDate && stop.endDate && (
          <span className="block text-xs text-zinc-400 dark:text-zinc-500">
            {new Date(stop.startDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
            {' – '}
            {new Date(stop.endDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}

        <span className="mt-1 flex gap-3 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            Budget: {fmt(stop.allocatedPence)}
          </span>
          {stop.type === 'destination' && (
            <span
              className={
                stop.isOverBudget
                  ? 'font-medium text-red-600 dark:text-red-400'
                  : 'text-zinc-500 dark:text-zinc-400'
              }
            >
              Actual: {fmt(stop.spentPence)}
            </span>
          )}
        </span>

        <span className="mt-0.5 block text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Remaining: {fmt(stop.runningTotalPence)}
        </span>
      </span>
    </button>
  );
}
