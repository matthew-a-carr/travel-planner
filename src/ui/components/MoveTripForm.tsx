'use client';

import { useActionState } from 'react';
import { type MoveTripState, moveTripToOrganizationAction } from '@/app/trips/[id]/actions';

const INITIAL_STATE: MoveTripState = { error: null };

type MoveTripTarget = {
  readonly id: string;
  readonly name: string;
};

export function MoveTripForm({ tripId, targets }: { tripId: string; targets: MoveTripTarget[] }) {
  const boundAction = moveTripToOrganizationAction.bind(null, tripId);
  const [state, dispatch, isPending] = useActionState(boundAction, INITIAL_STATE);

  if (targets.length === 0) return null;

  return (
    <form action={dispatch} className="flex items-center gap-2">
      <label htmlFor="move-trip-target" className="text-sm text-zinc-500 dark:text-zinc-300">
        Move to
      </label>
      <select
        id="move-trip-target"
        name="targetOrganizationId"
        defaultValue={targets[0]?.id}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {targets.map((target) => (
          <option key={target.id} value={target.id}>
            {target.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {isPending ? 'Moving…' : 'Move'}
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
