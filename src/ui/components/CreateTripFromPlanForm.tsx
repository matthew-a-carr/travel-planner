'use client';

import { useActionState, useState } from 'react';
import {
  type CreateTripState,
  createTripFromPlanAction,
  type PlanTripFromTextState,
  planTripFromTextAction,
} from '@/app/trips/actions';
import type { ComfortLevel } from '@/domain/trip/types';

const COMFORTS: ComfortLevel[] = ['budget', 'mid', 'luxury'];

const initialPlanState: PlanTripFromTextState = { error: null, result: null };
const initialCreateState: CreateTripState = { error: null };

type EditableRow = {
  uiKey: string;
  country: string;
  city: string | null;
  startDate: string;
  endDate: string;
  comfortLevel: ComfortLevel;
  estimatedBudgetPounds: string;
};

function isoToInput(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function penceToPoundsString(pence: number | null): string {
  if (pence === null) return '';
  return (pence / 100).toFixed(0);
}

export function CreateTripFromPlanForm({ onCancel }: { onCancel: () => void }) {
  const [planState, planDispatch, planPending] = useActionState<PlanTripFromTextState, FormData>(
    planTripFromTextAction,
    initialPlanState,
  );

  const [createState, createDispatch, createPending] = useActionState<CreateTripState, FormData>(
    createTripFromPlanAction,
    initialCreateState,
  );

  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [unresolved, setUnresolved] = useState<readonly string[]>([]);
  const [nameDraft, setNameDraft] = useState('');
  const [budgetDraft, setBudgetDraft] = useState('');

  // Mirror server parse result into local editable state when it changes.
  if (planState.result && rows === null) {
    setRows(
      planState.result.rows.map((r) => ({
        uiKey: crypto.randomUUID(),
        country: r.country,
        city: r.city,
        startDate: isoToInput(r.startDate),
        endDate: isoToInput(r.endDate),
        comfortLevel: r.comfortLevel ?? 'mid',
        estimatedBudgetPounds: penceToPoundsString(r.suggestedBudgetPence),
      })),
    );
    setUnresolved(planState.result.unresolved);
    setNameDraft(planState.result.suggestedName);
    setBudgetDraft(penceToPoundsString(planState.result.suggestedBudgetPence ?? 0) || '');
  }

  function updateRow(i: number, patch: Partial<EditableRow>) {
    if (!rows) return;
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    setRows(next);
  }

  function removeRow(i: number) {
    if (!rows) return;
    setRows(rows.filter((_, idx) => idx !== i));
  }

  function reset() {
    setRows(null);
    setUnresolved([]);
    setNameDraft('');
    setBudgetDraft('');
  }

  const candidatesPayload = rows
    ? JSON.stringify(
        rows.map((r) => ({
          name: r.city ?? r.country,
          country: r.country,
          city: r.city,
          latitude: null,
          longitude: null,
          estimatedBudgetPence: Math.max(
            0,
            Math.round(Number.parseFloat(r.estimatedBudgetPounds || '0') * 100),
          ),
          currency: 'GBP',
          comfortLevel: r.comfortLevel,
          startDate: r.startDate || null,
          endDate: r.endDate || null,
        })),
      )
    : '[]';

  const allBudgetsValid =
    rows?.every(
      (r) =>
        r.estimatedBudgetPounds.trim() !== '' &&
        Number.parseFloat(r.estimatedBudgetPounds) >= 0 &&
        !Number.isNaN(Number.parseFloat(r.estimatedBudgetPounds)),
    ) ?? false;

  const submitDisabled =
    createPending ||
    !rows ||
    rows.length === 0 ||
    !allBudgetsValid ||
    nameDraft.trim().length === 0 ||
    Number.parseFloat(budgetDraft || '0') <= 0;

  if (!rows) {
    return (
      <form action={planDispatch} className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Paste a rough itinerary, booking confirmation, or trip summary. The assistant extracts
          destinations and suggests a name and budget you can edit before saving.
        </p>
        <textarea
          name="text"
          required
          rows={6}
          placeholder="3 weeks Vietnam from Aug 1, then Cambodia for 10 days, Laos a week, Thailand til mid-Oct"
          className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {planState.error && (
          <p className="text-sm text-red-600" data-testid="plan-trip-parse-error">
            {planState.error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={planPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={planPending}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {planPending ? 'Parsing…' : 'Plan the trip'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={createDispatch} className="space-y-4">
      {unresolved.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
          Couldn't classify: {unresolved.join('; ')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="plan-name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Trip name
          </label>
          <input
            id="plan-name"
            name="name"
            type="text"
            required
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor="plan-budget"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            Total budget (£)
          </label>
          <input
            id="plan-budget"
            name="totalBudgetPounds"
            type="number"
            required
            min="0"
            step="1"
            value={budgetDraft}
            onChange={(e) => setBudgetDraft(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Suggested from destinations + 10% contingency. Edit freely.
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Destinations</p>
        <ul className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.uiKey}
              className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                <input
                  aria-label={`Country for row ${i + 1}`}
                  value={r.country}
                  onChange={(e) => updateRow(i, { country: e.target.value })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 sm:col-span-2"
                />
                <input
                  aria-label={`City for row ${i + 1}`}
                  value={r.city ?? ''}
                  onChange={(e) => updateRow(i, { city: e.target.value || null })}
                  placeholder="City (optional)"
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 sm:col-span-2"
                />
                <select
                  aria-label={`Comfort for row ${i + 1}`}
                  value={r.comfortLevel}
                  onChange={(e) => updateRow(i, { comfortLevel: e.target.value as ComfortLevel })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {COMFORTS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="date"
                  aria-label={`Start date for row ${i + 1}`}
                  value={r.startDate}
                  onChange={(e) => updateRow(i, { startDate: e.target.value })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <input
                  type="date"
                  aria-label={`End date for row ${i + 1}`}
                  value={r.endDate}
                  onChange={(e) => updateRow(i, { endDate: e.target.value })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  aria-label={`Budget (£) for row ${i + 1}`}
                  placeholder="Budget (£)"
                  value={r.estimatedBudgetPounds}
                  onChange={(e) => updateRow(i, { estimatedBudgetPounds: e.target.value })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <input type="hidden" name="candidates" value={candidatesPayload} />

      {createState.error && (
        <p className="text-sm text-red-600" data-testid="plan-trip-create-error">
          {createState.error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            reset();
            onCancel();
          }}
          disabled={createPending}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={createPending}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Start over
        </button>
        <button
          type="submit"
          disabled={submitDisabled}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {createPending
            ? 'Creating…'
            : `Create with ${rows.length} destination${rows.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </form>
  );
}
