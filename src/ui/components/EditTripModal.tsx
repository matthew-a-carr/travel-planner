'use client';

import { useActionState, useState } from 'react';
import { type EditTripState, editTripAction } from '@/app/trips/[id]/actions';
import type { Trip } from '@/domain/trip/types';

const STATUSES: { value: Trip['status']; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

function EditTripForm({ trip, onCancel }: { trip: Trip; onCancel: () => void }) {
  const boundAction = editTripAction.bind(null, trip.id);
  const initialState: EditTripState = { error: null };
  const [state, dispatch, isPending] = useActionState(boundAction, initialState);

  const defaultBudget = (trip.totalBudget.amountPence / 100).toFixed(2);

  return (
    <form action={dispatch} className="space-y-5">
      <div>
        <label
          htmlFor="edit-trip-name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          Trip name
        </label>
        <input
          id="edit-trip-name"
          name="name"
          type="text"
          required
          defaultValue={trip.name}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      <div>
        <label
          htmlFor="edit-trip-totalBudgetPounds"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          Total budget (£)
        </label>
        <input
          id="edit-trip-totalBudgetPounds"
          name="totalBudgetPounds"
          type="number"
          required
          min="0"
          step="0.01"
          defaultValue={defaultBudget}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      <div>
        <label
          htmlFor="edit-trip-status"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          Status
        </label>
        <select
          id="edit-trip-status"
          name="status"
          defaultValue={trip.status}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

export function EditTripButton({ trip }: { trip: Trip }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Edit trip"
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        Edit trip
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Edit trip
            </h2>
            <EditTripForm trip={trip} onCancel={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
