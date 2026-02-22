'use client';

import { useState, useTransition } from 'react';
import { removeDestinationAction } from '@/app/trips/[id]/actions';
import { calculateTotalSpend } from '@/domain/spending/spend-entry';
import type { Destination, SpendEntry } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { AddDestinationForm } from './AddDestinationForm';
import { RecordSpendForm } from './RecordSpendForm';

type Props = {
  tripId: string;
  destinations: Destination[];
  allSpend: SpendEntry[];
};

export function DestinationSection({ tripId, destinations, allSpend }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Destinations</h2>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          {showAddForm ? 'Cancel' : 'Add destination'}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-zinc-700">New destination</h3>
          <AddDestinationForm tripId={tripId} onSuccess={() => setShowAddForm(false)} />
        </div>
      )}

      {destinations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center">
          <p className="text-zinc-500">No destinations added yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Add destinations to start allocating your budget.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {destinations.map((dest) => {
            const destSpend = allSpend.filter((s) => s.destinationId === dest.id);
            return (
              <DestinationCard key={dest.id} tripId={tripId} destination={dest} spend={destSpend} />
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
}: {
  tripId: string;
  destination: Destination;
  spend: SpendEntry[];
}) {
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalSpend = calculateTotalSpend(spend);
  const spendPence = totalSpend.amountPence;
  const budgetPence = destination.estimatedBudget.amountPence;
  const spendPercent = budgetPence > 0 ? Math.min((spendPence / budgetPence) * 100, 100) : 0;
  const isOverSpend = spendPence > budgetPence;

  const comfortLabel: Record<string, string> = {
    budget: 'Budget',
    mid: 'Mid-range',
    luxury: 'Luxury',
  };

  function handleRemove() {
    startTransition(async () => {
      await removeDestinationAction(tripId, destination.id);
    });
  }

  return (
    <li className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-zinc-900">{destination.name}</p>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
              {comfortLabel[destination.comfortLevel] ?? destination.comfortLevel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">{destination.country}</p>
        </div>

        <div className="flex items-center gap-2 pl-4">
          <button
            type="button"
            onClick={() => setShowSpendForm((v) => !v)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            {showSpendForm ? 'Cancel' : 'Add spend'}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            aria-label={`Remove ${destination.name}`}
            className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {isPending ? '…' : 'Remove'}
          </button>
        </div>
      </div>

      {/* Budget vs spend bar */}
      <div className="border-t border-zinc-100 px-5 py-3">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Estimated: {formatMoney(destination.estimatedBudget)}</span>
          <span className={isOverSpend ? 'font-medium text-red-600' : ''}>
            Spent: {formatMoney(totalSpend)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full ${isOverSpend ? 'bg-red-500' : 'bg-zinc-800'}`}
            style={{ width: `${spendPercent}%` }}
          />
        </div>
        {isOverSpend && <p className="mt-1 text-xs text-red-600">Over estimated budget</p>}
      </div>

      {/* Spend entries */}
      {spend.length > 0 && (
        <div className="border-t border-zinc-100 px-5 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Spend log
          </p>
          <ul className="space-y-1">
            {spend.map((entry) => (
              <li key={entry.id} className="flex justify-between text-sm">
                <span className="text-zinc-600">
                  <span className="capitalize">{entry.category}</span>
                  {entry.description && (
                    <span className="ml-1 text-zinc-400">— {entry.description}</span>
                  )}
                </span>
                <span className="font-medium text-zinc-900">{formatMoney(entry.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add spend form */}
      {showSpendForm && (
        <div className="border-t border-zinc-100 px-5 py-4">
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
