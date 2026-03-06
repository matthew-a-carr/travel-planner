import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCountryReferences } from '@/application/use-cases/get-country-references';
import { sortDestinations } from '@/domain/destination/destination';
import { calculateTotalSpend } from '@/domain/spending/spend-entry';
import { getTripBudgetSummary } from '@/domain/trip/trip';
import type { Trip, TripFixedCost } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { db } from '@/infrastructure/db/client';
import { DrizzleCountryReferenceRepository } from '@/infrastructure/db/repositories/drizzle-country-reference-repository';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import { getActiveOrganizationContext } from '@/infrastructure/organization/active-organization';
import { ChartsSection } from '@/ui/components/ChartsSection';
import { DestinationSection } from '@/ui/components/DestinationSection';
import { EditTripButton } from '@/ui/components/EditTripModal';
import { FixedCostSection } from '@/ui/components/FixedCostSection';
import { MoveTripForm } from '@/ui/components/MoveTripForm';

type Props = { params: Promise<{ id: string }> };

export default async function TripDetailPage({ params }: Props) {
  const { id } = await params;
  const context = await getActiveOrganizationContext();
  if (!context) redirect('/login');

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(id);
  if (!trip) notFound();

  const organizationRepository = new DrizzleOrganizationRepository(db);
  const membership = await organizationRepository.findMembership(
    trip.organizationId,
    context.userId,
  );
  if (!membership) notFound();
  const moveTargets =
    membership.role === 'owner'
      ? context.organizations
          .filter(
            (organization) =>
              organization.role === 'owner' && organization.organization.id !== trip.organizationId,
          )
          .map((organization) => ({
            id: organization.organization.id,
            name: organization.organization.name,
          }))
      : [];

  const destRepo = new DrizzleDestinationRepository(db);
  const spendRepo = new DrizzleSpendEntryRepository(db);
  const fixedCostRepo = new DrizzleTripFixedCostRepository(db);
  const refRepo = new DrizzleCountryReferenceRepository(db);

  const [destinations, allSpend, fixedCosts, countryReferences] = await Promise.all([
    destRepo.findByTrip(id),
    spendRepo.findByTrip(id),
    fixedCostRepo.findByTrip(id),
    getCountryReferences(refRepo),
  ]);

  const sorted = sortDestinations(destinations);
  const summary = getTripBudgetSummary(trip, destinations, fixedCosts);

  // Chart data — computed server-side, passed as plain serialisable props
  const budgetBreakdownData = [
    ...fixedCosts.map((fc) => ({
      label: fc.label,
      amountPence: fc.amount.amountPence,
      fill: '#f59e0b', // amber-500
    })),
    {
      label: 'Destinations',
      amountPence: summary.allocated.amountPence,
      fill: '#3b82f6', // blue-500
    },
    {
      label: 'Available',
      amountPence: Math.max(summary.available.amountPence, 0),
      fill: '#22c55e', // green-500
    },
  ];

  const estimatedVsActualData = sorted.map((dest) => {
    const destSpend = allSpend.filter((s) => s.destinationId === dest.id);
    const actual = calculateTotalSpend(destSpend).amountPence;
    return {
      name: dest.name,
      estimated: dest.estimatedBudget.amountPence,
      actual,
    };
  });

  const spendByCategoryData = (() => {
    const totals: Record<string, number> = {};
    for (const entry of allSpend) {
      totals[entry.category] = (totals[entry.category] ?? 0) + entry.amount.amountPence;
    }
    return Object.entries(totals).map(([category, amountPence]) => ({ category, amountPence }));
  })();

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <nav className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
            Dashboard
          </Link>{' '}
          / <span className="text-zinc-900 dark:text-zinc-100">{trip.name}</span>
        </nav>

        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{trip.name}</h1>
            <StatusBadge status={trip.status} />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-300">
              {context.organizations.find(
                (organization) => organization.organization.id === trip.organizationId,
              )?.organization.name ?? 'Organization'}
            </p>
          </div>
          <div className="space-y-2 text-right">
            <EditTripButton trip={trip} />
            <MoveTripForm tripId={trip.id} targets={moveTargets} />
          </div>
        </header>

        <BudgetOverviewCard summary={summary} fixedCosts={fixedCosts} />

        <FixedCostSection tripId={id} fixedCosts={fixedCosts} />

        <ChartsSection
          budgetBreakdown={budgetBreakdownData}
          estimatedVsActual={estimatedVsActualData}
          spendByCategory={spendByCategoryData}
        />

        <DestinationSection
          tripId={id}
          destinations={sorted}
          allSpend={allSpend}
          countryReferences={countryReferences}
        />
      </div>
    </main>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Trip['status'] }) {
  const colours: Record<string, string> = {
    planning: 'bg-amber-100 text-amber-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300',
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
  summary,
  fixedCosts,
}: {
  summary: ReturnType<typeof getTripBudgetSummary>;
  fixedCosts: TripFixedCost[];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Budget overview
      </h2>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-700 dark:text-zinc-200">Total budget</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatMoney(summary.total)}
          </span>
        </div>

        {fixedCosts.map((fc) => (
          <div key={fc.id} className="flex justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">{fc.label}</span>
            <span className="font-medium text-zinc-500 dark:text-zinc-400">
              −{formatMoney(fc.amount)}
            </span>
          </div>
        ))}

        {fixedCosts.length === 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400 dark:text-zinc-500 italic">No fixed costs yet</span>
            <span className="text-zinc-400 dark:text-zinc-500">−£0.00</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Allocated to destinations</span>
          <span className="font-medium text-zinc-500 dark:text-zinc-400">
            −{formatMoney(summary.allocated)}
          </span>
        </div>

        <div className="flex justify-between border-t border-zinc-100 dark:border-zinc-800 pt-2 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">Available</span>
          <span
            className={`font-medium ${
              summary.isOverAllocated
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-700 dark:text-green-400'
            }`}
          >
            {formatMoney(summary.available)}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            role="progressbar"
            aria-valuenow={Math.min(summary.allocationPercentage, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Budget allocation: ${summary.allocationPercentage}% allocated`}
            className={`h-full rounded-full transition-all ${
              summary.isOverAllocated ? 'bg-red-500' : 'bg-zinc-800 dark:bg-zinc-300'
            }`}
            style={{ width: `${Math.min(summary.allocationPercentage, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-300">
          {summary.allocationPercentage}% allocated
        </p>
      </div>

      {summary.isOverAllocated && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Budget exceeded — reduce fixed costs or destination allocations.
        </p>
      )}
    </div>
  );
}
