'use client';

import { useActionState, useState, useTransition } from 'react';
import type { FixedCostState } from '@/app/trips/[id]/actions';
import { addFixedCostAction, removeFixedCostAction } from '@/app/trips/[id]/actions';
import type { TripFixedCost } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';

const initial: FixedCostState = { error: null };

export function FixedCostSection({
  tripId,
  fixedCosts,
}: {
  tripId: string;
  fixedCosts: TripFixedCost[];
}) {
  const boundAction = addFixedCostAction.bind(null, tripId);
  const [state, dispatch, isPending] = useActionState(
    async (prev: FixedCostState, formData: FormData) => {
      const result = await boundAction(prev, formData);
      return result;
    },
    initial,
  );

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-zinc-900">Fixed costs</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Flights, insurance, subscriptions — costs deducted from your budget before destination
        allocations. Enter the total (e.g. &quot;Phone £40/mo × 6&quot; = £240).
      </p>

      {fixedCosts.length > 0 && (
        <ul className="mb-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {fixedCosts.map((fc) => (
            <FixedCostRow key={fc.id} tripId={tripId} fixedCost={fc} />
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-medium text-zinc-500">Add fixed cost</p>
        <form action={dispatch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="fc-label" className="block text-sm font-medium text-zinc-700">
              Label
            </label>
            <input
              id="fc-label"
              name="label"
              type="text"
              required
              placeholder="Flights to Asia"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div className="w-36">
            <label htmlFor="fc-amount" className="block text-sm font-medium text-zinc-700">
              Amount (£)
            </label>
            <input
              id="fc-amount"
              name="amountPounds"
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="950"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? 'Adding…' : 'Add'}
          </button>
        </form>
        {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      </div>
    </section>
  );
}

function FixedCostRow({ tripId, fixedCost }: { tripId: string; fixedCost: TripFixedCost }) {
  const [isPending, startTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900">{fixedCost.label}</p>
          <p className="text-sm text-zinc-500">{formatMoney(fixedCost.amount)}</p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setRemoveError(null);
            startTransition(async () => {
              try {
                await removeFixedCostAction(tripId, fixedCost.id);
              } catch {
                setRemoveError('Failed to remove. Please try again.');
              }
            });
          }}
          aria-label={`Remove ${fixedCost.label}`}
          className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {isPending ? '…' : 'Remove'}
        </button>
      </div>
      {removeError && <p className="mt-1 text-xs text-red-600">{removeError}</p>}
    </li>
  );
}
