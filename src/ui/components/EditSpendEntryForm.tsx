'use client';

import { useActionState } from 'react';
import type { EditSpendEntryState } from '@/app/trips/[id]/actions';
import { editSpendEntryAction } from '@/app/trips/[id]/actions';
import type { SpendEntry } from '@/domain/trip/types';

const CATEGORY_OPTIONS = [
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'food', label: 'Food & drink' },
  { value: 'transport', label: 'Transport' },
  { value: 'activities', label: 'Activities' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
] as const;

const initial: EditSpendEntryState = { error: null };

export function EditSpendEntryForm({
  tripId,
  entry,
  onSuccess,
  onCancel,
}: {
  tripId: string;
  entry: SpendEntry;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const boundAction = editSpendEntryAction.bind(null, tripId, entry.id);

  const [state, dispatch, isPending] = useActionState(
    async (prev: EditSpendEntryState, formData: FormData) => {
      const result = await boundAction(prev, formData);
      if (!result.error) onSuccess();
      return result;
    },
    initial,
  );

  const defaultAmount = (entry.amount.amountPence / 100).toFixed(2);
  const defaultDate = entry.spentAt.toISOString().split('T')[0] ?? '';

  return (
    <form action={dispatch} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`edit-spend-amount-${entry.id}`}
            className="block text-xs font-medium text-zinc-700"
          >
            Amount (£)
          </label>
          <input
            id={`edit-spend-amount-${entry.id}`}
            name="amountPounds"
            type="number"
            required
            min="0.01"
            step="0.01"
            defaultValue={defaultAmount}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor={`edit-spend-date-${entry.id}`}
            className="block text-xs font-medium text-zinc-700"
          >
            Date
          </label>
          <input
            id={`edit-spend-date-${entry.id}`}
            name="spentAt"
            type="date"
            required
            defaultValue={defaultDate}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`edit-spend-category-${entry.id}`}
          className="block text-xs font-medium text-zinc-700"
        >
          Category
        </label>
        <select
          id={`edit-spend-category-${entry.id}`}
          name="category"
          required
          defaultValue={entry.category}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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
          htmlFor={`edit-spend-description-${entry.id}`}
          className="block text-xs font-medium text-zinc-700"
        >
          Description <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <input
          id={`edit-spend-description-${entry.id}`}
          name="description"
          type="text"
          defaultValue={entry.description ?? ''}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
