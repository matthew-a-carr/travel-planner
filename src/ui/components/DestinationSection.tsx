'use client';

import { useState, useTransition } from 'react';
import { deleteSpendEntryAction, removeDestinationAction } from '@/app/trips/[id]/actions';
import type { CityReference, CountryReference } from '@/domain/country-reference/types';
import { destinationDays } from '@/domain/destination/destination';
import { calculateTotalSpend } from '@/domain/spending/spend-entry';
import type { Currency, Destination, SpendEntry } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { AddDestinationForm } from './AddDestinationForm';
import { BurnRateIndicator } from './BurnRateIndicator';
import { EditDestinationForm } from './EditDestinationForm';
import { EditSpendEntryForm } from './EditSpendEntryForm';
import { RecordSpendForm } from './RecordSpendForm';

const COMFORT_LABELS: Record<string, string> = {
  budget: 'Budget',
  mid: 'Mid-range',
  luxury: 'Luxury',
};

type BurndownData = {
  dailyPacePence: number;
  targetPacePence: number;
  paceRatio: number;
  projectedExhaustionDate: string | null;
};

type Props = {
  tripId: string;
  destinations: Destination[];
  allSpend: SpendEntry[];
  countryReferences: CountryReference[];
  cityReferences: CityReference[];
  burndownByDestination: Record<string, BurndownData>;
  currency: Currency;
};

export function DestinationSection({
  tripId,
  destinations,
  allSpend,
  countryReferences,
  cityReferences,
  burndownByDestination,
  currency,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Destinations</h2>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {showAddForm ? 'Cancel' : 'Add destination'}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            New destination
          </h3>
          <AddDestinationForm
            tripId={tripId}
            countryReferences={countryReferences}
            cityReferences={cityReferences}
            onSuccess={() => setShowAddForm(false)}
          />
        </div>
      )}

      {destinations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No destinations added yet.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Add destinations to start allocating your budget.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {destinations.map((dest) => {
            const destSpend = allSpend.filter((s) => s.destinationId === dest.id);
            return (
              <DestinationCard
                key={dest.id}
                tripId={tripId}
                destination={dest}
                spend={destSpend}
                countryReferences={countryReferences}
                burndown={burndownByDestination[dest.id] ?? null}
                currency={currency}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DestinationCard({
  tripId,
  destination,
  spend,
  countryReferences,
  burndown,
  currency,
}: {
  tripId: string;
  destination: Destination;
  spend: SpendEntry[];
  countryReferences: CountryReference[];
  burndown: BurndownData | null;
  currency: Currency;
}) {
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  const totalSpend = calculateTotalSpend(spend);
  const spendPence = totalSpend.amountPence;
  const budgetPence = destination.estimatedBudget.amountPence;
  const spendPercent = budgetPence > 0 ? Math.min((spendPence / budgetPence) * 100, 100) : 0;
  const isOverSpend = spendPence > budgetPence;

  const days = destinationDays(destination);

  function handleRemove() {
    setRemoveError(null);
    startTransition(async () => {
      const result = await removeDestinationAction(tripId, destination.id);
      if (!result.ok) setRemoveError(result.error);
    });
  }

  return (
    <li className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{destination.name}</p>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
              {COMFORT_LABELS[destination.comfortLevel] ?? destination.comfortLevel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {destination.city ? `${destination.city}, ${destination.country}` : destination.country}
            {days !== null && (
              <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                · {days} {days === 1 ? 'day' : 'days'}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 pl-4">
          <button
            type="button"
            onClick={() => {
              setShowEditForm((v) => !v);
              setShowSpendForm(false);
            }}
            aria-label={`Edit ${destination.name}`}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {showEditForm ? 'Cancel' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSpendForm((v) => !v);
              setShowEditForm(false);
            }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {showSpendForm ? 'Cancel' : 'Add spend'}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            aria-label={`Remove ${destination.name}`}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            {isPending ? '…' : 'Remove'}
          </button>
        </div>
      </div>

      {removeError && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-2">
          <p className="text-xs text-red-600">{removeError}</p>
        </div>
      )}

      {/* Edit destination form */}
      {showEditForm && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-4">
          <EditDestinationForm
            tripId={tripId}
            destination={destination}
            countryReferences={countryReferences}
            onSuccess={() => setShowEditForm(false)}
            onCancel={() => setShowEditForm(false)}
          />
        </div>
      )}

      {/* Budget vs spend bar */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3">
        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Estimated: {formatMoney(destination.estimatedBudget)}</span>
          <span className={isOverSpend ? 'font-medium text-red-600' : ''}>
            Spent: {formatMoney(totalSpend)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            role="progressbar"
            aria-valuenow={Math.min(Math.round(spendPercent), 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Spend progress for ${destination.name}: ${Math.min(Math.round(spendPercent), 100)}% of budget used`}
            className={`h-full rounded-full ${isOverSpend ? 'bg-red-500' : 'bg-zinc-800 dark:bg-zinc-300'}`}
            style={{ width: `${spendPercent}%` }}
          />
        </div>
        {isOverSpend && <p className="mt-1 text-xs text-red-600">Over estimated budget</p>}
      </div>

      {/* Burn rate indicator */}
      {burndown && (
        <BurnRateIndicator
          dailyPacePence={burndown.dailyPacePence}
          targetPacePence={burndown.targetPacePence}
          paceRatio={burndown.paceRatio}
          projectedExhaustionDate={burndown.projectedExhaustionDate}
          currency={currency}
        />
      )}

      {/* Spend entries */}
      {spend.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Spend log
          </p>
          <ul className="space-y-1">
            {spend.map((entry) => (
              <SpendEntryRow key={entry.id} tripId={tripId} entry={entry} />
            ))}
          </ul>
        </div>
      )}

      {/* Add spend form */}
      {showSpendForm && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-4">
          <RecordSpendForm
            tripId={tripId}
            destinationId={destination.id}
            onSuccess={() => setShowSpendForm(false)}
          />
        </div>
      )}
    </li>
  );
}

function SpendEntryRow({ tripId, entry }: { tripId: string; entry: SpendEntry }) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteSpendEntryAction(tripId, entry.id);
      if (!result.ok) setDeleteError(result.error);
    });
  }

  return (
    <li className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5">
      {showEditForm ? (
        <EditSpendEntryForm
          tripId={tripId}
          entry={entry}
          onSuccess={() => setShowEditForm(false)}
          onCancel={() => setShowEditForm(false)}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="capitalize">{entry.category}</span>
              {entry.description && (
                <span className="ml-1 text-zinc-400 dark:text-zinc-500">— {entry.description}</span>
              )}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoney(entry.amount)}
              </span>
              <button
                type="button"
                onClick={() => setShowEditForm(true)}
                aria-label={`Edit spend entry: ${entry.category}${entry.description ? ` — ${entry.description}` : ''}`}
                className="rounded px-2 py-0.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label={`Delete spend entry: ${entry.category}${entry.description ? ` — ${entry.description}` : ''}`}
                className="rounded px-2 py-0.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                {isDeleting ? '…' : 'Delete'}
              </button>
            </div>
          </div>
          {deleteError && <p className="mt-1 text-xs text-red-600">{deleteError}</p>}
        </>
      )}
    </li>
  );
}
