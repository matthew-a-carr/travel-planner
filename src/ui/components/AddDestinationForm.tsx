'use client';

import { useActionState } from 'react';
import type { AddDestinationState } from '@/app/trips/[id]/actions';
import { addDestinationAction } from '@/app/trips/[id]/actions';

const COMFORT_OPTIONS = [
  { value: 'budget', label: 'Budget' },
  { value: 'mid', label: 'Mid-range' },
  { value: 'luxury', label: 'Luxury' },
] as const;

const initial: AddDestinationState = { error: null };

export function AddDestinationForm({
  tripId,
  onSuccess,
}: {
  tripId: string;
  onSuccess: () => void;
}) {
  const boundAction = addDestinationAction.bind(null, tripId);

  const [state, dispatch, isPending] = useActionState(
    async (prev: AddDestinationState, formData: FormData) => {
      const result = await boundAction(prev, formData);
      if (!result.error) onSuccess();
      return result;
    },
    initial,
  );

  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="dest-name" className="block text-sm font-medium text-zinc-700">
            Name
          </label>
          <input
            id="dest-name"
            name="name"
            type="text"
            required
            placeholder="Japan"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label htmlFor="dest-country" className="block text-sm font-medium text-zinc-700">
            Country
          </label>
          <input
            id="dest-country"
            name="country"
            type="text"
            required
            placeholder="Japan"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="dest-budget" className="block text-sm font-medium text-zinc-700">
            Estimated budget (£)
          </label>
          <input
            id="dest-budget"
            name="estimatedBudgetPounds"
            type="number"
            required
            min="0.01"
            step="0.01"
            placeholder="5000"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label htmlFor="dest-comfort" className="block text-sm font-medium text-zinc-700">
            Comfort level
          </label>
          <select
            id="dest-comfort"
            name="comfortLevel"
            required
            defaultValue="mid"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            {COMFORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Add destination'}
        </button>
      </div>
    </form>
  );
}
