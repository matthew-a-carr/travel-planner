'use client';

import { useActionState, useId, useState } from 'react';
import {
  type ProfileFormState,
  updateTravellerProfileAction,
} from '@/app/settings/profile/actions';
import type { CountryReference } from '@/domain/country-reference/types';
import type { TravellerProfile } from '@/domain/visa/types';
import { CountryCombobox } from './CountryCombobox';

type PassportRow = { readonly key: string; readonly countryName: string; readonly label: string };

let rowSeq = 0;
function newRow(countryName = '', label = ''): PassportRow {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, countryName, label };
}

const inputClass =
  'mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100';
const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-200';

export function TravellerProfileForm({
  profile,
  countries,
}: {
  profile: TravellerProfile;
  countries: readonly CountryReference[];
}) {
  const nameByAlpha3 = new Map(countries.map((c) => [c.alpha3, c.country]));
  const alpha3ByName = new Map(countries.map((c) => [c.country, c.alpha3]));

  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  const [rows, setRows] = useState<PassportRow[]>(
    profile.passports.map((p) => newRow(nameByAlpha3.get(p.nationality) ?? '', p.label ?? '')),
  );

  const [state, action, isPending] = useActionState<ProfileFormState, FormData>(
    updateTravellerProfileAction,
    { error: null, notice: null },
  );

  const dobId = useId();

  function updateRow(key: string, patch: Partial<PassportRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  return (
    <form action={action} className="space-y-6">
      <div>
        <label htmlFor={dobId} className={labelClass}>
          Date of birth
        </label>
        <input
          id={dobId}
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Used to check age-restricted visas (e.g. working-holiday eligibility).
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Passports</legend>
        {rows.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No passports added yet.</p>
        )}
        {rows.map((row) => {
          const nationality = alpha3ByName.get(row.countryName) ?? '';
          return (
            <div
              key={row.key}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-end dark:border-zinc-700"
            >
              <input type="hidden" name="passportNationality" value={nationality} />
              <div className="flex-1">
                <label htmlFor={`nationality-${row.key}`} className={labelClass}>
                  Nationality
                </label>
                <div className="mt-1">
                  <CountryCombobox
                    id={`nationality-${row.key}`}
                    name="passportCountryDisplay"
                    countries={countries}
                    value={row.countryName}
                    onChange={(country) => updateRow(row.key, { countryName: country })}
                    placeholder="Search nationalities…"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label htmlFor={`label-${row.key}`} className={labelClass}>
                  Label <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <input
                  id={`label-${row.key}`}
                  name="passportLabel"
                  type="text"
                  value={row.label}
                  onChange={(e) => updateRow(row.key, { label: e.target.value })}
                  placeholder="e.g. UK passport"
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-label={`Remove ${row.countryName || 'passport'}`}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Add passport
        </button>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">
          {state.notice}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
