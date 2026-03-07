import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Trip } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { auth } from '@/infrastructure/auth';
import { getVisibleSignInProviders } from '@/infrastructure/auth/provider-availability';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';
import { AuthenticatedAppHeader } from '@/ui/components/AuthenticatedAppHeader';
import { CreateTripButton } from '@/ui/components/CreateTripModal';
import { SignInButton } from '@/ui/components/SignInButton';

export default async function HomePage() {
  const session = await auth();
  const accessContext = await getAuthenticatedAccessContext();
  const { showGoogle, showLocalDev } = getVisibleSignInProviders();

  if (!session?.user || !accessContext) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Travel Planner
            </h1>
            <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-300">
              Plan and track spending for your round-the-world adventure.
            </p>
          </div>
          <SignInButton showGoogle={showGoogle} showLocalDev={showLocalDev} />
        </div>
      </main>
    );
  }

  if (!session.user.id) redirect('/login');
  if (!accessContext.activeOrganization) redirect('/settings/organizations');

  const { tripRepository } = getAppContainer();
  const trips = await tripRepository.findAllByOrganization(
    accessContext.activeOrganization.organization.id,
  );

  return (
    <main className="min-h-screen">
      <AuthenticatedAppHeader
        activeNav="trips"
        organizations={accessContext.organizations.map((organization) => ({
          id: organization.organization.id,
          name: organization.organization.name,
          role: organization.role,
        }))}
        activeOrganizationId={accessContext.activeOrganization.organization.id}
        userImage={session.user.image}
        userName={session.user.name}
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8">
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your trips</h1>
            <CreateTripButton />
          </div>

          {trips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-600">
              <p className="text-zinc-500 dark:text-zinc-400">
                Welcome, {session.user.name ?? session.user.email}. This organization has no trips
                yet.
              </p>
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                Create your first trip to get started.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const statusColour: Record<string, string> = {
    planning: 'bg-amber-100 text-amber-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300',
  };

  return (
    <li>
      <Link
        href={`/trips/${trip.id}`}
        className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{trip.name}</p>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Total budget: {formatMoney(trip.totalBudget)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColour[trip.status] ?? ''}`}
        >
          {trip.status}
        </span>
      </Link>
    </li>
  );
}
