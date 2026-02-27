'use client';

import { useState, useTransition } from 'react';
import { deleteSpendEntryAction } from '@/app/trips/[id]/actions';
import { calculateTotalSpend } from '@/domain/spending/spend-entry';
import type { SpendEntry } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { EditSpendEntryForm } from './EditSpendEntryForm';
import { RecordSpendForm } from './RecordSpendForm';

export function DestinationSpendSection({
  tripId,
  destinationId,
  spend,
}: {
  tripId: string;
  destinationId: string;
  spend: SpendEntry[];
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const totalSpend = calculateTotalSpend(spend);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">Spend</h2>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          {showAddForm ? 'Cancel' : 'Add spend'}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <RecordSpendForm
            tripId={tripId}
            destinationId={destinationId}
            onSuccess={() => setShowAddForm(false)}
          />
        </div>
      )}

      {spend.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center">
          <p className="text-zinc-500">No spend recorded yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Use &ldquo;Add spend&rdquo; to record your first expense.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex justify-between border-b border-zinc-100 px-5 py-3">
            <span className="text-sm font-medium text-zinc-700">Total spent</span>
            <span className="text-sm font-semibold text-zinc-900">{formatMoney(totalSpend)}</span>
          </div>
          <ul className="divide-y divide-zinc-100">
            {spend.map((entry) => (
              <SpendRow key={entry.id} tripId={tripId} entry={entry} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SpendRow({ tripId, entry }: { tripId: string; entry: SpendEntry }) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      try {
        await deleteSpendEntryAction(tripId, entry.id);
      } catch {
        setDeleteError('Failed to delete. Please try again.');
      }
    });
  }

  return (
    <li className="px-5 py-3">
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
            <span className="min-w-0 text-sm text-zinc-600">
              <span className="capitalize">{entry.category}</span>
              {entry.description && (
                <span className="ml-1 text-zinc-400">— {entry.description}</span>
              )}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-medium text-zinc-900">{formatMoney(entry.amount)}</span>
              <button
                type="button"
                onClick={() => setShowEditForm(true)}
                aria-label={`Edit spend entry: ${entry.category}${entry.description ? ` — ${entry.description}` : ''}`}
                className="rounded px-2 py-0.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
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
