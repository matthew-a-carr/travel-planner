'use client';

import { useActionState, useState } from 'react';
import { type DeleteTripState, deleteTripAction } from '@/app/trips/[id]/actions';

const INITIAL_STATE: DeleteTripState = { error: null };

export function DeleteTripButton({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = deleteTripAction.bind(null, tripId);
  const [state, dispatch, isPending] = useActionState(boundAction, INITIAL_STATE);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Delete trip"
        className="w-full rounded-lg px-3 py-1.5 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
      >
        Delete trip
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Delete trip
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
              This permanently deletes the trip and all associated fixed costs, destinations, and
              spend entries. This action cannot be undone.
            </p>

            <form action={dispatch} className="space-y-4">
              {state.error && <p className="text-sm text-red-600">{state.error}</p>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
