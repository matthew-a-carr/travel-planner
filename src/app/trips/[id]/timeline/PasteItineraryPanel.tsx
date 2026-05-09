'use client';

import { useActionState, useState } from 'react';
import type { ComfortLevel, Currency } from '@/domain/trip/types';
import {
  type ApplyItineraryState,
  applyParsedItineraryAction,
  type ParseItineraryState,
  parseItineraryAction,
} from './actions';

const initialParseState: ParseItineraryState = { error: null, result: null };
const initialApplyState: ApplyItineraryState = { error: null, addedCount: 0 };

const COMFORTS: ComfortLevel[] = ['budget', 'mid', 'luxury'];

type EditableRow = {
  uiKey: string;
  country: string;
  city: string | null;
  startDate: string; // YYYY-MM-DD or ''
  endDate: string;
  comfortLevel: ComfortLevel;
  estimatedBudgetPounds: string; // form-friendly string
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
};

function isoToInput(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function penceToPoundsString(pence: number | null): string {
  if (pence === null) return '';
  return (pence / 100).toFixed(0);
}

type Props = {
  tripId: string;
  defaultCurrency: Currency;
};

export function PasteItineraryPanel({ tripId, defaultCurrency }: Props) {
  const boundParse = parseItineraryAction.bind(null, tripId);
  const boundApply = applyParsedItineraryAction.bind(null, tripId);

  const [parseState, parseDispatch, parsePending] = useActionState<ParseItineraryState, FormData>(
    boundParse,
    initialParseState,
  );

  const [applyState, applyDispatch, applyPending] = useActionState<ApplyItineraryState, FormData>(
    boundApply,
    initialApplyState,
  );

  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [unresolved, setUnresolved] = useState<readonly string[]>([]);

  // Mirror server parse result into local editable state when it changes.
  if (parseState.result && rows === null) {
    setRows(
      parseState.result.rows.map((r) => ({
        uiKey: crypto.randomUUID(),
        country: r.country,
        city: r.city,
        startDate: isoToInput(r.startDate),
        endDate: isoToInput(r.endDate),
        comfortLevel: r.comfortLevel ?? 'mid',
        estimatedBudgetPounds: penceToPoundsString(r.suggestedBudgetPence),
        confidence: r.confidence,
        notes: r.notes,
      })),
    );
    setUnresolved(parseState.result.unresolved);
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
          currency: defaultCurrency,
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

  return (
    <section
      aria-labelledby="paste-itinerary-heading"
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm"
    >
      <h2
        id="paste-itinerary-heading"
        className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
      >
        Paste an itinerary
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Paste a booking confirmation, trip summary, or freeform notes. AI extracts the destinations
        and pre-fills budgets.
      </p>

      {!rows && (
        <form action={parseDispatch} className="mt-4 space-y-3">
          <textarea
            name="text"
            required
            rows={6}
            placeholder="3 weeks Vietnam from Aug 1, then Cambodia for 10 days, Laos a week, Thailand til mid-Oct"
            className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {parseState.error && <p className="text-sm text-red-600">{parseState.error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={parsePending}
              className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {parsePending ? 'Parsing…' : 'Extract destinations'}
            </button>
          </div>
        </form>
      )}

      {rows && (
        <div className="mt-4 space-y-4">
          {unresolved.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
              Couldn't classify: {unresolved.join('; ')}
            </div>
          )}

          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li
                key={r.uiKey}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3"
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                  <input
                    aria-label={`Country for row ${i + 1}`}
                    value={r.country}
                    onChange={(e) => updateRow(i, { country: e.target.value })}
                    className="sm:col-span-2 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <input
                    aria-label={`City for row ${i + 1}`}
                    value={r.city ?? ''}
                    onChange={(e) => updateRow(i, { city: e.target.value || null })}
                    placeholder="City (optional)"
                    className="sm:col-span-2 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
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

                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Confidence: {r.confidence}
                  {r.notes ? ` · ${r.notes}` : ''}
                </p>
              </li>
            ))}
          </ul>

          {applyState.error && <p className="text-sm text-red-600">{applyState.error}</p>}
          {applyState.addedCount > 0 && (
            <p className="text-sm text-green-700 dark:text-green-400">
              Added {applyState.addedCount} destination{applyState.addedCount === 1 ? '' : 's'} to
              the timeline.
            </p>
          )}

          <form action={applyDispatch} className="flex justify-end gap-3">
            <input type="hidden" name="candidates" value={candidatesPayload} />
            <button
              type="button"
              onClick={reset}
              disabled={applyPending}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={applyPending || rows.length === 0 || !allBudgetsValid}
              className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {applyPending
                ? 'Adding…'
                : `Add ${rows.length} destination${rows.length === 1 ? '' : 's'}`}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
