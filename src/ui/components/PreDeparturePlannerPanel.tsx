'use client';

import { useActionState } from 'react';
import { addFixedCostAction, type FixedCostState } from '@/app/trips/[id]/actions';
import {
  checklistCategoryToFixedCostCategory,
  transportLegFixedCostCategory,
  transportLegLabel,
} from '@/domain/pre-departure/checklist-mapping';
import type {
  ChecklistCategory,
  ChecklistItem,
  PreDeparturePlan,
  TransportLeg,
  TransportMode,
} from '@/domain/pre-departure/types';
import type { Destination, TripFixedCost } from '@/domain/trip/types';

const initialState: FixedCostState = { error: null };

const CATEGORY_LABEL: Record<ChecklistCategory, string> = {
  visa: 'Visa',
  vaccination: 'Health',
  insurance: 'Insurance',
  banking: 'Banking',
  admin: 'Admin',
};

const MODE_LABEL: Record<TransportMode, string> = {
  flight: 'Flight',
  train: 'Train',
  bus: 'Bus',
  ferry: 'Ferry',
  car: 'Road',
};

type Props = {
  readonly tripId: string;
  readonly plan: PreDeparturePlan;
  readonly destinations: readonly Destination[];
  readonly fixedCosts: readonly TripFixedCost[];
};

export function PreDeparturePlannerPanel({ tripId, plan, destinations, fixedCosts }: Props) {
  if (plan.items.length === 0 && plan.transportLegs.length === 0) return null;

  const existingLabels = new Set(fixedCosts.map((fc) => fc.label.toLowerCase()));
  const destinationById = new Map(destinations.map((d) => [d.id, d]));

  return (
    <section
      aria-labelledby="pre-departure-heading"
      data-testid="pre-departure-panel"
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="pre-departure-heading"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Pre-departure planning
        </h2>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          AI suggestions
        </span>
      </div>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Suggested checklist and transport items. Each one is a one-click add to your fixed costs —
        always verify the details with the embassy, insurer, or clinic.
      </p>

      {plan.items.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Checklist
          </h3>
          <ul className="mt-2 space-y-2">
            {plan.items.map((item) => (
              <ChecklistItemRow
                key={`${item.category}-${item.title}`}
                tripId={tripId}
                item={item}
                alreadyAdded={existingLabels.has(item.title.toLowerCase())}
              />
            ))}
          </ul>
        </div>
      )}

      {plan.transportLegs.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Transport
          </h3>
          <ul className="mt-2 space-y-2">
            {plan.transportLegs.map((leg) => {
              const from = destinationById.get(leg.fromDestinationId);
              const to = destinationById.get(leg.toDestinationId);
              if (!from || !to) return null;
              const label = transportLegLabel(leg.mode, from.name, to.name);
              return (
                <TransportLegRow
                  key={`${leg.fromDestinationId}->${leg.toDestinationId}`}
                  tripId={tripId}
                  leg={leg}
                  fromName={from.name}
                  toName={to.name}
                  legStartDate={from.endDate ?? to.startDate}
                  alreadyAdded={existingLabels.has(label.toLowerCase())}
                />
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function ChecklistItemRow({
  tripId,
  item,
  alreadyAdded,
}: {
  tripId: string;
  item: ChecklistItem;
  alreadyAdded: boolean;
}) {
  const boundAction = addFixedCostAction.bind(null, tripId);
  const [state, dispatch, isPending] = useActionState(boundAction, initialState);

  const dueLabel = item.dueDate ? item.dueDate.toISOString().slice(0, 10) : null;
  const costPounds = item.costPence !== null ? (item.costPence / 100).toFixed(0) : null;
  const dateForForm = (item.dueDate ?? new Date()).toISOString().slice(0, 10);
  const categoryForForm = checklistCategoryToFixedCostCategory(item.category);
  const addable = item.costPence !== null && !alreadyAdded;

  return (
    <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {CATEGORY_LABEL[item.category]}
            </span>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
          </div>
          {item.suggestion && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.suggestion}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            {dueLabel && <span>Due by {dueLabel}</span>}
            {costPounds !== null && <span>≈ £{costPounds}</span>}
          </div>
        </div>
        {addable ? (
          <form action={dispatch}>
            <input type="hidden" name="label" value={item.title} />
            <input type="hidden" name="amountPounds" value={costPounds ?? '0'} />
            <input type="hidden" name="category" value={categoryForForm} />
            <input type="hidden" name="date" value={dateForForm} />
            <button
              type="submit"
              disabled={isPending}
              className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {isPending ? 'Adding…' : 'Add as fixed cost'}
            </button>
          </form>
        ) : alreadyAdded ? (
          <span className="shrink-0 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-200">
            Already added
          </span>
        ) : (
          <span className="shrink-0 text-[11px] italic text-zinc-400 dark:text-zinc-500">
            Info only
          </span>
        )}
      </div>
      {state.error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </li>
  );
}

function TransportLegRow({
  tripId,
  leg,
  fromName,
  toName,
  legStartDate,
  alreadyAdded,
}: {
  tripId: string;
  leg: TransportLeg;
  fromName: string;
  toName: string;
  legStartDate: Date | null;
  alreadyAdded: boolean;
}) {
  const boundAction = addFixedCostAction.bind(null, tripId);
  const [state, dispatch, isPending] = useActionState(boundAction, initialState);

  const label = transportLegLabel(leg.mode, fromName, toName);
  const dateForForm = (legStartDate ?? new Date()).toISOString().slice(0, 10);
  const costPounds = (leg.typicalCostPence / 100).toFixed(0);
  const category = transportLegFixedCostCategory();

  return (
    <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {MODE_LABEL[leg.mode]}
            </span>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
          </div>
          {leg.notes && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{leg.notes}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>≈ £{costPounds}</span>
            {leg.bookingLeadDays > 0 && <span>Book {leg.bookingLeadDays}+ days out</span>}
          </div>
        </div>
        {alreadyAdded ? (
          <span className="shrink-0 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-200">
            Already added
          </span>
        ) : (
          <form action={dispatch}>
            <input type="hidden" name="label" value={label} />
            <input type="hidden" name="amountPounds" value={costPounds} />
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="date" value={dateForForm} />
            <button
              type="submit"
              disabled={isPending}
              className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {isPending ? 'Adding…' : 'Add as fixed cost'}
            </button>
          </form>
        )}
      </div>
      {state.error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </li>
  );
}
