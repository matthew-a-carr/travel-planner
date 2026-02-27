import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { destinationDays } from '@/domain/destination/destination';
import { calculateTotalSpend } from '@/domain/spending/spend-entry';
import type { Destination } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import { DestinationSpendSection } from '@/ui/components/DestinationSpendSection';

const COMFORT_LABELS: Record<string, string> = {
  budget: 'Budget',
  mid: 'Mid-range',
  luxury: 'Luxury',
};

type Props = { params: Promise<{ id: string; destId: string }> };

export default async function DestinationDetailPage({ params }: Props) {
  const { id: tripId, destId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== session.user.id) notFound();

  const destRepo = new DrizzleDestinationRepository(db);
  const destination = await destRepo.findById(destId);
  if (!destination || destination.tripId !== tripId) notFound();

  const spendRepo = new DrizzleSpendEntryRepository(db);
  const spend = await spendRepo.findByDestination(destId);

  const totalSpend = calculateTotalSpend(spend);
  const spendPence = totalSpend.amountPence;
  const budgetPence = destination.estimatedBudget.amountPence;
  const spendPercent = budgetPence > 0 ? Math.min((spendPence / budgetPence) * 100, 100) : 0;
  const isOverSpend = spendPence > budgetPence;
  const days = destinationDays(destination);

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <nav className="text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-900">
            Dashboard
          </Link>{' '}
          /{' '}
          <Link href={`/trips/${tripId}`} className="hover:text-zinc-900">
            {trip.name}
          </Link>{' '}
          / <span className="text-zinc-900">{destination.name}</span>
        </nav>

        <header>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900">{destination.name}</h1>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
              {COMFORT_LABELS[destination.comfortLevel] ?? destination.comfortLevel}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {destination.country}
            {days !== null && (
              <span className="ml-2 text-zinc-400">
                · {days} {days === 1 ? 'day' : 'days'}
              </span>
            )}
          </p>
        </header>

        <BudgetProgressCard
          destination={destination}
          spendPercent={spendPercent}
          isOverSpend={isOverSpend}
          totalSpend={totalSpend}
        />

        <DestinationSpendSection tripId={tripId} destinationId={destId} spend={spend} />
      </div>
    </main>
  );
}

function BudgetProgressCard({
  destination,
  spendPercent,
  isOverSpend,
  totalSpend,
}: {
  destination: Destination;
  spendPercent: number;
  isOverSpend: boolean;
  totalSpend: ReturnType<typeof calculateTotalSpend>;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-700">Estimated budget</span>
        <span className="font-medium text-zinc-900">
          {formatMoney(destination.estimatedBudget)}
        </span>
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="text-zinc-500">Spent so far</span>
        <span className={`font-medium ${isOverSpend ? 'text-red-600' : 'text-zinc-900'}`}>
          {formatMoney(totalSpend)}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          role="progressbar"
          aria-valuenow={Math.min(Math.round(spendPercent), 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`h-full rounded-full ${isOverSpend ? 'bg-red-500' : 'bg-zinc-800'}`}
          style={{ width: `${spendPercent}%` }}
        />
      </div>
      {isOverSpend && <p className="mt-2 text-xs text-red-600">Over estimated budget</p>}
    </div>
  );
}
