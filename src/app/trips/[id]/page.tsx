import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sortDestinations } from '@/domain/destination/destination';
import { getTripBudgetSummary } from '@/domain/trip/trip';
import type { Trip } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import { DestinationSection } from '@/ui/components/DestinationSection';

type Props = { params: Promise<{ id: string }> };

export default async function TripDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect('/login');

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(id);

  if (!trip || trip.ownerId !== session.user.id) notFound();

  const destRepo = new DrizzleDestinationRepository(db);
  const spendRepo = new DrizzleSpendEntryRepository(db);

  const [destinations, allSpend] = await Promise.all([
    destRepo.findByTrip(id),
    spendRepo.findByTrip(id),
  ]);

  const sorted = sortDestinations(destinations);
  const summary = getTripBudgetSummary(trip, destinations);

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <nav className="text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-900">
            Dashboard
          </Link>{' '}
          / <span className="text-zinc-900">{trip.name}</span>
        </nav>

        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{trip.name}</h1>
            <StatusBadge status={trip.status} />
          </div>
        </header>

        <BudgetOverviewCard trip={trip} summary={summary} />

        <DestinationSection tripId={id} destinations={sorted} allSpend={allSpend} />
      </div>
    </main>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Trip['status'] }) {
  const colours: Record<string, string> = {
    planning: 'bg-amber-100 text-amber-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-zinc-100 text-zinc-600',
  };
  return (
    <span
      className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colours[status] ?? ''}`}
    >
      {status}
    </span>
  );
}

// ─── Budget overview ──────────────────────────────────────────────────────────

function BudgetOverviewCard({
  trip,
  summary,
}: {
  trip: Trip;
  summary: ReturnType<typeof getTripBudgetSummary>;
}) {
  const rows = [
    { label: 'Total budget', value: formatMoney(summary.total), muted: false },
    {
      label: trip.ringfencedLabel ?? 'Ringfenced',
      value: `−${formatMoney(summary.ringfenced)}`,
      muted: true,
    },
    {
      label: 'Allocated to destinations',
      value: `−${formatMoney(summary.allocated)}`,
      muted: true,
    },
    {
      label: 'Available',
      value: formatMoney(summary.available),
      muted: false,
      highlight: summary.isOverAllocated ? 'text-red-600' : 'text-green-700',
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-zinc-900">Budget overview</h2>

      <div className="space-y-2">
        {rows.map(({ label, value, muted, highlight }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className={muted ? 'text-zinc-500' : 'text-zinc-700'}>{label}</span>
            <span
              className={`font-medium ${highlight ?? (muted ? 'text-zinc-500' : 'text-zinc-900')}`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-all ${
              summary.isOverAllocated ? 'bg-red-500' : 'bg-zinc-800'
            }`}
            style={{ width: `${Math.min(summary.allocationPercentage, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-zinc-400">
          {summary.allocationPercentage}% allocated
        </p>
      </div>

      {summary.isOverAllocated && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Budget exceeded — reduce destination allocations.
        </p>
      )}
    </div>
  );
}
