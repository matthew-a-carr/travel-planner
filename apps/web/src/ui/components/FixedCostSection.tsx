'use client';

import { useActionState, useState, useTransition } from 'react';
import type { FixedCostState } from '@/app/trips/[id]/actions';
import { addFixedCostAction, removeFixedCostAction } from '@/app/trips/[id]/actions';
import type { TripFixedCost } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { EditFixedCostForm } from './EditFixedCostForm';

const FIXED_COST_CATEGORY_OPTIONS = [
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'activities', label: 'Activities' },
  { value: 'bills', label: 'Bills' },
  { value: 'eating-out', label: 'Eating Out' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'transport', label: 'Transport' },
  { value: 'visas', label: 'Visas' },
  { value: 'other', label: 'Other' },
] as const;

const initial: FixedCostState = { error: null };

export function FixedCostSection({
  tripId,
  fixedCosts,
}: {
  tripId: string;
  fixedCosts: TripFixedCost[];
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const boundAction = addFixedCostAction.bind(null, tripId);
  const [state, dispatch, isPending] = useActionState(
    async (prev: FixedCostState, formData: FormData) => {
      const result = await boundAction(prev, formData);
      if (!result.error) setShowAddForm(false);
      return result;
    },
    initial,
  );

  const today = new Date().toISOString().split('T')[0];

  return (
    <section id="fixed-costs" aria-labelledby="fixed-costs-heading" className="scroll-mt-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2
            id="fixed-costs-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Fixed costs
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Flights, insurance, subscriptions — costs deducted from your budget before destination
            allocations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {showAddForm ? 'Cancel' : 'Add fixed cost'}
        </button>
      </div>

      {fixedCosts.length > 0 && (
        <ul className="mb-4 divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
          {fixedCosts.map((fc) => (
            <FixedCostRow key={fc.id} tripId={tripId} fixedCost={fc} />
          ))}
        </ul>
      )}

      {showAddForm && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <form action={dispatch} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="fc-label"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  Label
                </label>
                <input
                  id="fc-label"
                  name="label"
                  type="text"
                  required
                  placeholder="Flights to Asia"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
              <div>
                <label
                  htmlFor="fc-amount"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  Amount (£)
                </label>
                <input
                  id="fc-amount"
                  name="amountPounds"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="950"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="fc-category"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  Category
                </label>
                <select
                  id="fc-category"
                  name="category"
                  required
                  defaultValue="other"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {FIXED_COST_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="fc-date"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  Date
                </label>
                <input
                  id="fc-date"
                  name="date"
                  type="date"
                  defaultValue={today}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  className="mt-1 block w-full max-w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isPending ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
          {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
        </div>
      )}
    </section>
  );
}

function FixedCostRow({ tripId, fixedCost }: { tripId: string; fixedCost: TripFixedCost }) {
  const [isPending, startTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const dateStr = new Date(fixedCost.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (showEditForm) {
    return (
      <li className="px-4 py-3">
        <EditFixedCostForm
          tripId={tripId}
          fixedCost={fixedCost}
          onSuccess={() => setShowEditForm(false)}
          onCancel={() => setShowEditForm(false)}
        />
      </li>
    );
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fixedCost.label}</p>
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{formatMoney(fixedCost.amount)}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {fixedCost.category}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{dateStr}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEditForm(true)}
            aria-label={`Edit fixed cost: ${fixedCost.label}`}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setRemoveError(null);
              startTransition(async () => {
                const result = await removeFixedCostAction(tripId, fixedCost.id);
                if (!result.ok) setRemoveError(result.error);
              });
            }}
            aria-label={`Remove fixed cost: ${fixedCost.label}`}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            {isPending ? '…' : 'Remove'}
          </button>
        </div>
      </div>
      {removeError && <p className="mt-1 text-xs text-red-600">{removeError}</p>}
    </li>
  );
}
