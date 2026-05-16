'use client';

import type { BudgetWaterfall, Currency } from '@/domain/trip/types';
import { formatMoney, moneyUnchecked } from '@/domain/trip/types';
import { BudgetTimelineStop } from './BudgetTimelineStop';

type Props = {
  waterfall: BudgetWaterfall;
  currency: Currency;
  selectedStopId: string | null;
  onStopClick: (stopId: string | null) => void;
};

export function BudgetTimeline({ waterfall, currency, selectedStopId, onStopClick }: Props) {
  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Budget timeline</h3>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Start: {formatMoney(moneyUnchecked(waterfall.startingBudgetPence, currency))}
        </span>
      </div>

      <div className="relative ml-4 border-l-2 border-zinc-200 pl-6 dark:border-zinc-700">
        {waterfall.stops.map((stop, i) => (
          <BudgetTimelineStop
            key={stop.destinationId ?? `stop-${i}`}
            stop={stop}
            currency={currency}
            isLast={i === waterfall.stops.length - 1 && waterfall.unallocatedPence <= 0}
            isSelected={stop.destinationId === selectedStopId}
            onClick={() => onStopClick(stop.destinationId)}
          />
        ))}

        {waterfall.unallocatedPence > 0 && (
          <div className="relative pb-0 pt-4">
            <div className="absolute -left-[31px] top-4 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-zinc-900" />
            <div className="text-xs">
              <p className="font-medium text-green-700 dark:text-green-400">
                Unallocated: {formatMoney(moneyUnchecked(waterfall.unallocatedPence, currency))}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
