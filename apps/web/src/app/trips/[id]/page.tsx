import { notFound, redirect } from 'next/navigation';
import { getCountryReferences } from '@/application/use-cases/get-country-references';
import { summariseTripNarrative } from '@/application/use-cases/summarise-trip-narrative';
import { getSuggestedPrompts } from '@/domain/chat/suggested-prompts';
import { sortDestinations } from '@/domain/destination/destination';
import { canDeleteTrips } from '@/domain/organization/organization';
import {
  calculateBurndownProjection,
  calculateTripBurndown,
  detectAlerts,
} from '@/domain/spending/burndown';
import { calculateTotalSpend } from '@/domain/spending/spend-entry';
import { buildBudgetWaterfall, getTripBudgetSummary } from '@/domain/trip/trip';
import type { Trip, TripFixedCost } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { auth } from '@/infrastructure/auth';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';
import { AuthenticatedAppHeader } from '@/ui/components/AuthenticatedAppHeader';
import { BudgetAlertBanner } from '@/ui/components/BudgetAlertBanner';
import { ChartsSection } from '@/ui/components/ChartsSection';
import { TripAssistantDrawer } from '@/ui/components/chat/TripAssistantDrawer';
import { DeleteTripButton } from '@/ui/components/DeleteTripModal';
import { DestinationSection } from '@/ui/components/DestinationSection';
import { EditTripButton } from '@/ui/components/EditTripModal';
import { FixedCostCategoryBreakdown } from '@/ui/components/FixedCostCategoryBreakdown';
import { FixedCostSection } from '@/ui/components/FixedCostSection';
import { JourneyMapSection } from '@/ui/components/JourneyMapSection';
import { MoveTripForm } from '@/ui/components/MoveTripForm';
import { TripActionsMenu } from '@/ui/components/TripActionsMenu';
import { TripNarrativePanel } from '@/ui/components/TripNarrativePanel';
import { TripNextStepsPanel } from '@/ui/components/TripNextStepsPanel';
import { TripTabs } from '@/ui/components/TripTabs';
import { getTripStage, hasTwoOrMoreDatedDestinations } from './trip-stage';

type Props = { params: Promise<{ id: string }> };

export default async function TripDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const context = await getAuthenticatedAccessContext();
  if (!context) redirect('/login');
  if (!context.activeOrganization) redirect('/settings/organizations');
  if (!session?.user) redirect('/login');

  const {
    aiCacheRepository,
    countryReferenceRepository,
    destinationRepository,
    hashFn,
    organizationRepository,
    spendEntryRepository,
    tripFixedCostRepository,
    tripNarrativeService,
    tripRepository,
  } = getAppContainer();
  const trip = await tripRepository.findById(id);
  if (!trip) notFound();

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
  const canDelete = canDeleteTrips(membership.role);
  const hasMoreActions = moveTargets.length > 0 || canDelete;

  const renderedAt = new Date();
  const [destinations, allSpend, fixedCosts, countryReferences, narrativeResult] =
    await Promise.all([
      destinationRepository.findByTrip(id),
      spendEntryRepository.findByTrip(id),
      tripFixedCostRepository.findByTrip(id),
      getCountryReferences(countryReferenceRepository),
      summariseTripNarrative(
        tripRepository,
        destinationRepository,
        tripFixedCostRepository,
        spendEntryRepository,
        tripNarrativeService,
        aiCacheRepository,
        hashFn,
        id,
        renderedAt,
      ),
    ]);
  const tripNarrative = narrativeResult.ok ? narrativeResult.value : { narrative: '', bullets: [] };

  const sorted = sortDestinations(destinations);
  const summary = getTripBudgetSummary(trip, destinations, fixedCosts);
  const stage = getTripStage(trip, destinations, fixedCosts, allSpend);
  const showCharts = stage === 'active' || stage === 'completed';
  const showJourneyMap =
    (stage === 'active' || stage === 'completed') && hasTwoOrMoreDatedDestinations(sorted);
  const showBudgetOverview = stage !== 'empty';
  const showFixedCostBreakdown =
    (stage === 'active' || stage === 'completed') && fixedCosts.length > 0;

  // Journey map waterfall — spend aggregated by destination
  const spendByDestination = new Map<string, number>();
  for (const entry of allSpend) {
    const current = spendByDestination.get(entry.destinationId) ?? 0;
    spendByDestination.set(entry.destinationId, current + entry.amount.amountPence);
  }
  const waterfall = buildBudgetWaterfall(trip, sorted, fixedCosts, spendByDestination);

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
    const totalSpendResult = calculateTotalSpend(destSpend);
    const actual = totalSpendResult.ok ? totalSpendResult.value.amountPence : 0;
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

  // Burndown data — computed server-side, serialised for client components
  const now = renderedAt;

  const burndownByDestination = new Map<
    string,
    {
      dailyPacePence: number;
      targetPacePence: number;
      paceRatio: number;
      projectedExhaustionDate: string | null;
    }
  >();

  const allBurndownAlerts: {
    destinationName: string;
    type: string;
    message: string;
    severity: 'warning' | 'danger';
  }[] = [];

  for (const dest of sorted) {
    if (!dest.startDate || !dest.endDate) continue;
    const destSpend = allSpend.filter((s) => s.destinationId === dest.id);
    const projection = calculateBurndownProjection(
      destSpend,
      dest.estimatedBudget.amountPence,
      dest.startDate,
      dest.endDate,
      now,
    );
    burndownByDestination.set(dest.id, {
      dailyPacePence: projection.dailyPacePence,
      targetPacePence: projection.targetPacePence,
      paceRatio: projection.paceRatio,
      projectedExhaustionDate: projection.projectedExhaustionDate?.toISOString() ?? null,
    });
    const alerts = detectAlerts(projection, destSpend, dest.endDate);
    for (const alert of alerts) {
      allBurndownAlerts.push({ destinationName: dest.name, ...alert });
    }
  }

  const tripBurndown = calculateTripBurndown(sorted, allSpend, now);
  const tripBurndownData = tripBurndown
    ? {
        idealLine: tripBurndown.idealLine.map((p) => ({
          date: p.date.toISOString(),
          amountPence: p.amountPence,
        })),
        actualLine: tripBurndown.actualLine.map((p) => ({
          date: p.date.toISOString(),
          amountPence: p.amountPence,
        })),
        projectedLine: tripBurndown.projectedLine.map((p) => ({
          date: p.date.toISOString(),
          amountPence: p.amountPence,
        })),
      }
    : null;

  if (tripBurndown) {
    const datedEnds = sorted
      .filter((d): d is typeof d & { endDate: Date } => d.endDate !== null)
      .map((d) => d.endDate.getTime());
    const latestEnd = new Date(Math.max(...datedEnds));
    const tripAlerts = detectAlerts(tripBurndown, allSpend, latestEnd);
    for (const alert of tripAlerts) {
      allBurndownAlerts.push({ destinationName: 'Trip overall', ...alert });
    }
  }

  const fixedCostByCategoryData = (() => {
    const totals: Record<string, { amountPence: number; count: number }> = {};
    for (const fc of fixedCosts) {
      const existing = totals[fc.category] ?? { amountPence: 0, count: 0 };
      totals[fc.category] = {
        amountPence: existing.amountPence + fc.amount.amountPence,
        count: existing.count + 1,
      };
    }
    const totalPence = fixedCosts.reduce((sum, fc) => sum + fc.amount.amountPence, 0);
    return Object.entries(totals)
      .map(([category, { amountPence, count }]) => ({
        category,
        amountPence,
        count,
        percentage: totalPence > 0 ? Math.round((amountPence / totalPence) * 100) : 0,
      }))
      .sort((a, b) => b.amountPence - a.amountPence);
  })();

  return (
    <main className="min-h-screen">
      <AuthenticatedAppHeader
        activeNav="trips"
        organizations={context.organizations.map((organization) => ({
          id: organization.organization.id,
          name: organization.organization.name,
          role: organization.role,
        }))}
        activeOrganizationId={context.activeOrganization.organization.id}
        userImage={session.user.image}
        userName={session.user.name}
      />

      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-12 pt-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{trip.name}</h1>
              <StatusBadge status={trip.status} />
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {context.organizations.find(
                (organization) => organization.organization.id === trip.organizationId,
              )?.organization.name ?? 'Organization'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <TripAssistantDrawer
              tripId={trip.id}
              suggestedPrompts={getSuggestedPrompts({
                tripStatus: trip.status,
                destinations: sorted,
                hasSpend: allSpend.length > 0,
                currentDate: now,
              })}
            />
            <EditTripButton trip={trip} />
            {hasMoreActions && (
              <TripActionsMenu>
                {moveTargets.length > 0 && <MoveTripForm tripId={trip.id} targets={moveTargets} />}
                {moveTargets.length > 0 && canDelete && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800" />
                )}
                {canDelete && <DeleteTripButton tripId={trip.id} />}
              </TripActionsMenu>
            )}
          </div>
        </header>

        <TripTabs tripId={id} active="overview" />

        {stage === 'empty' && (
          <TripNextStepsPanel
            hasDestinations={destinations.length > 0}
            hasFixedCosts={fixedCosts.length > 0}
          />
        )}

        {showBudgetOverview && <BudgetOverviewCard summary={summary} fixedCosts={fixedCosts} />}

        <TripNarrativePanel narrative={tripNarrative.narrative} bullets={tripNarrative.bullets} />

        {allBurndownAlerts.length > 0 && <BudgetAlertBanner alerts={allBurndownAlerts} />}

        <FixedCostSection tripId={id} fixedCosts={fixedCosts} />

        {showFixedCostBreakdown && <FixedCostCategoryBreakdown data={fixedCostByCategoryData} />}

        {showCharts && (
          <ChartsSection
            budgetBreakdown={budgetBreakdownData}
            estimatedVsActual={estimatedVsActualData}
            spendByCategory={spendByCategoryData}
            tripBurndown={tripBurndownData}
            currency={trip.totalBudget.currency}
          />
        )}

        {showJourneyMap && (
          <JourneyMapSection waterfall={waterfall} currency={trip.totalBudget.currency} />
        )}

        <DestinationSection
          tripId={id}
          destinations={sorted}
          allSpend={allSpend}
          countryReferences={countryReferences}
          burndownByDestination={Object.fromEntries(burndownByDestination)}
          currency={trip.totalBudget.currency}
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
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colours[status] ?? ''}`}
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
            <span className="italic text-zinc-600 dark:text-zinc-300">No fixed costs yet</span>
            <span className="text-zinc-600 dark:text-zinc-300">−£0.00</span>
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
