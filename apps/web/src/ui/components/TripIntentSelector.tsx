'use client';

import { useActionState } from 'react';
import { setTripIntentAction, type TripIntentState } from '@/app/trips/[id]/visa-intent-actions';
import { TRIP_INTENTS, type TripIntent } from '@/domain/trip/types';

const LABELS: Record<TripIntent, string> = {
  tourism: 'Tourism',
  'working-holiday': 'Working holiday',
  'long-stay': 'Long stay',
};

export function TripIntentSelector({ tripId, intent }: { tripId: string; intent: TripIntent }) {
  const [state, action, isPending] = useActionState<TripIntentState, FormData>(
    setTripIntentAction,
    { error: null },
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="tripId" value={tripId} />
      <label htmlFor="trip-intent" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Intent
      </label>
      <select
        id="trip-intent"
        name="intent"
        defaultValue={intent}
        disabled={isPending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {TRIP_INTENTS.map((value) => (
          <option key={value} value={value}>
            {LABELS[value]}
          </option>
        ))}
      </select>
      {/* No-JS fallback: the select auto-submits on change when JS is available. */}
      <button
        type="submit"
        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        disabled={isPending}
      >
        Apply
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
