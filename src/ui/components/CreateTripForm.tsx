'use client';

import { useActionState } from 'react';
import { createTripAction } from '@/app/trips/actions';

const initialState = { error: null as string | null };

function formAction(_prev: typeof initialState, formData: FormData) {
  return createTripAction(formData).then(
    () => initialState,
    (err: unknown) => ({
      error: err instanceof Error ? err.message : 'Something went wrong',
    }),
  );
}

export function CreateTripForm({ onCancel }: { onCancel: () => void }) {
  const [state, dispatch, isPending] = useActionState(formAction, initialState);

  return (
    <form action={dispatch} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
          Trip name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Round the World 2026"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="totalBudgetPounds" className="block text-sm font-medium text-zinc-700">
          Total budget (£)
        </label>
        <input
          id="totalBudgetPounds"
          name="totalBudgetPounds"
          type="number"
          required
          min="0"
          step="0.01"
          placeholder="50000"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Add flights, subscriptions, and other fixed costs after creating the trip.
        </p>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create trip'}
        </button>
      </div>
    </form>
  );
}
