'use client';

import { useActionState } from 'react';
import type { EditFixedCostState } from '@/app/trips/[id]/actions';
import { editFixedCostAction } from '@/app/trips/[id]/actions';
import type { TripFixedCost } from '@/domain/trip/types';

const FIXED_COST_CATEGORY_OPTIONS = [
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'activities', label: 'Activities' },
  { value: 'bills', label: 'Bills' },
  { value: 'eating-out', label: 'Eating Out' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'transport', label: 'Transport' },
  { value: 'visas', label: 'Visas' },
  { value: 'other', label: 'Other' },
] as const;

const initial: EditFixedCostState = { error: null };

export function EditFixedCostForm({
  tripId,
  fixedCost,
  onSuccess,
  onCancel,
}: {
  tripId: string;
  fixedCost: TripFixedCost;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const boundAction = editFixedCostAction.bind(null, tripId, fixedCost.id);

  const [state, dispatch, isPending] = useActionState(
    async (prev: EditFixedCostState, formData: FormData) => {
      const result = await boundAction(prev, formData);
      if (!result.error) onSuccess();
      return result;
    },
    initial,
  );

  const defaultAmount = (fixedCost.amount.amountPence / 100).toFixed(2);
  const defaultDate = new Date(fixedCost.date).toISOString().split('T')[0] ?? '';

  return (
    <form action={dispatch} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`edit-fc-label-${fixedCost.id}`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-200"
          >
            Label
          </label>
          <input
            id={`edit-fc-label-${fixedCost.id}`}
            name="label"
            type="text"
            required
            defaultValue={fixedCost.label}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor={`edit-fc-amount-${fixedCost.id}`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-200"
          >
            Amount (£)
          </label>
          <input
            id={`edit-fc-amount-${fixedCost.id}`}
            name="amountPounds"
            type="number"
            required
            min="0.01"
            step="0.01"
            defaultValue={defaultAmount}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`edit-fc-category-${fixedCost.id}`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-200"
          >
            Category
          </label>
          <select
            id={`edit-fc-category-${fixedCost.id}`}
            name="category"
            required
            defaultValue={fixedCost.category}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {FIXED_COST_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor={`edit-fc-date-${fixedCost.id}`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-200"
          >
            Date
          </label>
          <input
            id={`edit-fc-date-${fixedCost.id}`}
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
            onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
            className="mt-1 block w-full max-w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
      </div>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
