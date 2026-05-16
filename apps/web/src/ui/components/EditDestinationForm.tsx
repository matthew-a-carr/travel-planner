'use client';

import { useActionState, useState } from 'react';
import type { EditDestinationState } from '@/app/trips/[id]/actions';
import { editDestinationAction } from '@/app/trips/[id]/actions';
import { findReference, suggestBudget } from '@/domain/country-reference/country-reference';
import type { CountryReference } from '@/domain/country-reference/types';
import type { ComfortLevel, Destination } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { CityAutocomplete } from './CityAutocomplete';
import { CountryCombobox } from './CountryCombobox';

const COMFORT_OPTIONS: { value: ComfortLevel; label: string }[] = [
  { value: 'budget', label: 'Budget' },
  { value: 'mid', label: 'Mid-range' },
  { value: 'luxury', label: 'Luxury' },
];

const initial: EditDestinationState = { error: null };

function computeDays(startStr: string, endStr: string): number | null {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().split('T')[0] ?? '';
}

export function EditDestinationForm({
  tripId,
  destination,
  countryReferences,
  onSuccess,
  onCancel,
}: {
  tripId: string;
  destination: Destination;
  countryReferences: CountryReference[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [country, setCountry] = useState(destination.country);
  const [city, setCity] = useState(destination.city ?? '');
  const [latitude, setLatitude] = useState<number | null>(destination.latitude);
  const [longitude, setLongitude] = useState<number | null>(destination.longitude);
  const [startDate, setStartDate] = useState(toDateInputValue(destination.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(destination.endDate));
  const [comfortLevel, setComfortLevel] = useState<ComfortLevel>(destination.comfortLevel);

  const countryAlpha2 = country
    ? (countryReferences.find((r) => r.country === country)?.alpha2 ?? null)
    : null;

  const boundAction = editDestinationAction.bind(null, tripId, destination.id);

  const [state, dispatch, isPending] = useActionState(
    async (prev: EditDestinationState, formData: FormData) => {
      const result = await boundAction(prev, formData);
      if (!result.error) onSuccess();
      return result;
    },
    initial,
  );

  const days = computeDays(startDate, endDate);
  const reference = country ? findReference(country, countryReferences) : null;
  const suggestion =
    days !== null && reference ? suggestBudget(days, reference, comfortLevel) : null;

  const defaultBudget = (destination.estimatedBudget.amountPence / 100).toFixed(2);

  return (
    <form action={dispatch} className="space-y-4">
      {/* Name + Country */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`edit-dest-name-${destination.id}`}
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Name
          </label>
          <input
            id={`edit-dest-name-${destination.id}`}
            name="name"
            type="text"
            required
            defaultValue={destination.name}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor={`edit-dest-country-${destination.id}`}
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Country
          </label>
          <div className="mt-1">
            <CountryCombobox
              id={`edit-dest-country-${destination.id}`}
              name="country"
              countries={countryReferences}
              value={country}
              onChange={setCountry}
              required
              placeholder="Search countries…"
            />
          </div>
        </div>
      </div>

      {/* City (optional) */}
      <div>
        <label
          htmlFor={`edit-dest-city-${destination.id}`}
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          City <span className="text-zinc-400 dark:text-zinc-500">(optional — for map pin)</span>
        </label>
        <div className="mt-1">
          <CityAutocomplete
            id={`edit-dest-city-${destination.id}`}
            countryAlpha2={countryAlpha2}
            value={city}
            onChange={(c, lat, lng) => {
              setCity(c);
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </div>
      </div>
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="latitude" value={latitude ?? ''} />
      <input type="hidden" name="longitude" value={longitude ?? ''} />

      {/* Dates */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`edit-dest-start-${destination.id}`}
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Start date <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
          </label>
          <input
            id={`edit-dest-start-${destination.id}`}
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor={`edit-dest-end-${destination.id}`}
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            End date <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
          </label>
          <input
            id={`edit-dest-end-${destination.id}`}
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
            htmlFor={`edit-dest-budget-${destination.id}`}
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Estimated budget (£)
          </label>
          <input
            id={`edit-dest-budget-${destination.id}`}
            name="estimatedBudgetPounds"
            type="number"
            required
            min="0.01"
            step="0.01"
            defaultValue={defaultBudget}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {suggestion && days !== null && reference && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {reference.source === 'manual' ? 'Suggested' : 'Estimated'} {formatMoney(suggestion)}{' '}
              — {days} days in {reference.country} (
              {COMFORT_OPTIONS.find((o) => o.value === comfortLevel)?.label.toLowerCase()})
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor={`edit-dest-comfort-${destination.id}`}
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Comfort level
          </label>
          <select
            id={`edit-dest-comfort-${destination.id}`}
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
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
