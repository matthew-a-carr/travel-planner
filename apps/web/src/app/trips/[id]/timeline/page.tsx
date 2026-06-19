import { notFound, redirect } from 'next/navigation';
import { analyseTripTimeline } from '@/application/use-cases/analyse-trip-timeline';
import { getTravellerProfile } from '@/application/use-cases/get-traveller-profile';
import { sortDestinations } from '@/domain/destination/destination';
import { hasAiCredentials } from '@/infrastructure/ai/vercel-gateway-client';
import { auth } from '@/infrastructure/auth';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';
import { AuthenticatedAppHeader } from '@/ui/components/AuthenticatedAppHeader';
import { TripTabs } from '@/ui/components/TripTabs';
import { PasteItineraryPanel } from './PasteItineraryPanel';
import { TimelineInsightsPanel } from './TimelineInsightsPanel';
import { TripTimeline } from './TripTimeline';

type Props = { params: Promise<{ id: string }> };

export default async function TripTimelinePage({ params }: Props) {
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
    timelineInsightsService,
    tripFixedCostRepository,
    tripRepository,
    userProfileRepository,
  } = getAppContainer();

  const trip = await tripRepository.findById(id);
  if (!trip) notFound();

  const membership = await organizationRepository.findMembership(
    trip.organizationId,
    context.userId,
  );
  if (!membership) notFound();

  const [profile, references] = await Promise.all([
    getTravellerProfile(userProfileRepository, context.userId),
    countryReferenceRepository.findAll(),
  ]);
  const nameByAlpha3 = new Map(references.map((r) => [r.alpha3, r.country]));
  const nationalities =
    profile.passports.length > 0
      ? profile.passports.map((p) => nameByAlpha3.get(p.nationality) ?? p.nationality)
      : ['United Kingdom'];

  const [destinations, fixedCosts, insightsResult] = await Promise.all([
    destinationRepository.findByTrip(id),
    tripFixedCostRepository.findByTrip(id),
    analyseTripTimeline(
      tripRepository,
      destinationRepository,
      tripFixedCostRepository,
      countryReferenceRepository,
      timelineInsightsService,
      aiCacheRepository,
      hashFn,
      id,
      nationalities,
    ),
  ]);

  const sortedDestinations = sortDestinations(destinations);
  const findings = insightsResult.ok ? insightsResult.value : [];
  const aiAvailable = hasAiCredentials();

  return (
    <main className="min-h-screen">
      <AuthenticatedAppHeader
        activeNav="trips"
        organizations={context.organizations.map((o) => ({
          id: o.organization.id,
          name: o.organization.name,
          role: o.role,
        }))}
        activeOrganizationId={context.activeOrganization.organization.id}
        userImage={session.user.image}
        userName={session.user.name}
      />

      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-12 pt-8">
        <header>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{trip.name}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-300">
            {context.organizations.find((o) => o.organization.id === trip.organizationId)
              ?.organization.name ?? 'Organization'}
          </p>
        </header>

        <TripTabs tripId={id} active="timeline" />

        <PasteItineraryPanel tripId={id} defaultCurrency={trip.totalBudget.currency} />

        <TripTimeline destinations={sortedDestinations} fixedCosts={fixedCosts} />

        <TimelineInsightsPanel findings={findings} aiAvailable={aiAvailable} />
      </div>
    </main>
  );
}
