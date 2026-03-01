'use client';

import { useActionState, useState } from 'react';
import type { AddDestinationState } from '@/app/trips/[id]/actions';
import { addDestinationAction } from '@/app/trips/[id]/actions';
import { findReference, suggestBudget } from '@/domain/country-reference/country-reference';
import type { CountryReference } from '@/domain/country-reference/types';
import type { ComfortLevel } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';

const COMFORT_OPTIONS: { value: ComfortLevel; label: string }[] = [
  { value: 'budget', label: 'Budget' },
  { value: 'mid', label: 'Mid-range' },
  { value: 'luxury', label: 'Luxury' },
];

const initial: AddDestinationState = { error: null };

function computeDays(startStr: string, endStr: string): number | null {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function AddDestinationForm({
  tripId,
  countryReferences,
  onSuccess,
}: {
  tripId: string;
  countryReferences: CountryReference[];
  onSuccess: () => void;
}) {
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comfortLevel, setComfortLevel] = useState<ComfortLevel>('mid');

  const boundAction = addDestinationAction.bind(null, tripId);

  const [state, dispatch, isPending] = useActionState(
    async (prev: AddDestinationState, formData: FormData) => {
      const result = await boundAction(prev, formData);
      if (!result.error) onSuccess();
      return result;
    },
    initial,
  );

  // Compute suggestion client-side — no API call needed
  const days = computeDays(startDate, endDate);
  const reference = country ? findReference(country, countryReferences) : null;
  const suggestion =
    days !== null && reference ? suggestBudget(days, reference, comfortLevel) : null;

  return (
    <form action={dispatch} className="space-y-4">
      {/* Name + Country */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="dest-name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Name
          </label>
          <input
            id="dest-name"
            name="name"
            type="text"
            required
            placeholder="Japan"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor="dest-country"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Country
          </label>
          <input
            id="dest-country"
            name="country"
            type="text"
            required
            placeholder="Japan"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="dest-start"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Start date <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
          </label>
          <input
            id="dest-start"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor="dest-end"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            End date <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
          </label>
          <input
            id="dest-end"
            name="endDate"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Budget + Comfort */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="dest-budget"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Estimated budget (£)
          </label>
          <input
            id="dest-budget"
            name="estimatedBudgetPounds"
            type="number"
            required
            min="0.01"
            step="0.01"
            placeholder={suggestion ? String(Math.round(suggestion.amountPence / 100)) : '5000'}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {suggestion && days !== null && reference && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Suggested {formatMoney(suggestion)} — {days} days in {reference.country} (
              {COMFORT_OPTIONS.find((o) => o.value === comfortLevel)?.label.toLowerCase()})
            </p>
          )}
          {country && !reference && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              No reference data for &quot;{country}&quot;
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="dest-comfort"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Comfort level
          </label>
          <select
            id="dest-comfort"
            name="comfortLevel"
            required
            value={comfortLevel}
            onChange={(e) => setComfortLevel(e.target.value as ComfortLevel)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
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
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Saving…' : 'Add destination'}
        </button>
      </div>
    </form>
  );
}
