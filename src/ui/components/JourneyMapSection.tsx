'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { BudgetWaterfall, Currency } from '@/domain/trip/types';
import { BudgetTimeline } from './BudgetTimeline';

const JourneyMap = dynamic(() => import('./JourneyMap').then((m) => m.JourneyMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading map…</p>
    </div>
  ),
});

type Props = {
  waterfall: BudgetWaterfall;
  currency: Currency;
};

export function JourneyMapSection({ waterfall, currency }: Props) {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  function handleStopClick(stopId: string | null) {
    setSelectedStopId((prev) => (prev === stopId ? null : stopId));
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">Journey map</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <JourneyMap
            waterfall={waterfall}
            selectedStopId={selectedStopId}
            onStopClick={handleStopClick}
          />
        </div>
        <div className="lg:col-span-1">
          <BudgetTimeline
            waterfall={waterfall}
            currency={currency}
            selectedStopId={selectedStopId}
            onStopClick={handleStopClick}
          />
        </div>
      </div>
    </section>
  );
}
