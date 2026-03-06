import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getOrganizationMembers } from '@/application/use-cases/get-organization-members';
import type { Trip } from '@/domain/trip/types';
import { formatMoney } from '@/domain/trip/types';
import { auth } from '@/infrastructure/auth';
import { getVisibleSignInProviders } from '@/infrastructure/auth/provider-availability';
import { db } from '@/infrastructure/db/client';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import { getActiveOrganizationContext } from '@/infrastructure/organization/active-organization';
import { CreateTripButton } from '@/ui/components/CreateTripModal';
import { OrganizationWorkspacePanel } from '@/ui/components/OrganizationWorkspacePanel';
import { SignInButton } from '@/ui/components/SignInButton';
import { SignOutButton } from '@/ui/components/SignOutButton';
import { UserAvatar } from '@/ui/components/UserAvatar';

export default async function HomePage() {
  const session = await auth();
  const organizationContext = await getActiveOrganizationContext();
  const { showGoogle, showLocalDev } = getVisibleSignInProviders();

  if (!session?.user || !organizationContext) {
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

  const repo = new DrizzleTripRepository(db);
  const trips = await repo.findAllByOrganization(
    organizationContext.activeOrganization.organization.id,
  );
  const organizationRepository = new DrizzleOrganizationRepository(db);
  const membersResult = await getOrganizationMembers(
    organizationRepository,
    organizationContext.activeOrganization.organization.id,
    organizationContext.userId,
  );
  const members = membersResult.ok ? membersResult.value.members : [];

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Travel Planner</h1>
            <div className="flex items-center gap-4">
              <UserAvatar image={session.user.image} name={session.user.name} />
              <SignOutButton />
            </div>
          </div>
          <OrganizationWorkspacePanel
            organizations={organizationContext.organizations.map((organization) => ({
              id: organization.organization.id,
              name: organization.organization.name,
              role: organization.role,
            }))}
            activeOrganizationId={organizationContext.activeOrganization.organization.id}
            currentUserId={organizationContext.userId}
            members={members}
          />
        </header>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your trips</h2>
            <CreateTripButton />
          </div>

          {trips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-10 text-center">
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
