'use client';

import { useActionState } from 'react';
import type { RecordSpendState } from '@/app/trips/[id]/actions';
import { recordSpendAction } from '@/app/trips/[id]/actions';

const CATEGORY_OPTIONS = [
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'food', label: 'Food & drink' },
  { value: 'transport', label: 'Transport' },
  { value: 'activities', label: 'Activities' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
] as const;

const initial: RecordSpendState = { error: null };

export function RecordSpendForm({
  tripId,
  destinationId,
  onSuccess,
}: {
  tripId: string;
  destinationId: string;
  onSuccess: () => void;
}) {
  const boundAction = recordSpendAction.bind(null, tripId, destinationId);

  const [state, dispatch, isPending] = useActionState(
    async (prev: RecordSpendState, formData: FormData) => {
      const result = await boundAction(prev, formData);
      if (!result.error) onSuccess();
      return result;
    },
    initial,
  );

  const today = new Date().toISOString().split('T')[0];

  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="spend-amount"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Amount (£)
          </label>
          <input
            id="spend-amount"
            name="amountPounds"
            type="number"
            required
            min="0.01"
            step="0.01"
            placeholder="120.50"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor="spend-date"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Date
          </label>
          <input
            id="spend-date"
            name="spentAt"
            type="date"
            required
            defaultValue={today}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="spend-category"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          Category
        </label>
        <select
          id="spend-category"
          name="category"
          required
          defaultValue="food"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="spend-description"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          Description{' '}
          <span className="font-normal text-zinc-400 dark:text-zinc-500">(optional)</span>
        </label>
        <input
          id="spend-description"
          name="description"
          type="text"
          placeholder="Ramen dinner"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Saving…' : 'Record spend'}
        </button>
      </div>
    </form>
  );
}
