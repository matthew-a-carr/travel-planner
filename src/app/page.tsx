import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import { SignOutButton } from '@/ui/components/SignOutButton';
import { SignInButton } from '@/ui/components/SignInButton';
import { CreateTripButton } from '@/ui/components/CreateTripModal';
import { formatMoney } from '@/domain/trip/types';
import type { Trip } from '@/domain/trip/types';

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
              Wanderlust Budget
            </h1>
            <p className="mt-3 text-lg text-zinc-600">
              Plan and track spending for your round-the-world adventure.
            </p>
          </div>
          <SignInButton />
        </div>
      </main>
    );
  }

  if (!session.user.id) redirect('/login');

  const repo = new DrizzleTripRepository(db);
  const trips = await repo.findAllByOwner(session.user.id);

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900">Wanderlust Budget</h1>
          <div className="flex items-center gap-4">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? 'User'}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full"
              />
            )}
            <SignOutButton />
          </div>
        </header>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Your trips</h2>
            <CreateTripButton />
          </div>

          {trips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center">
              <p className="text-zinc-500">
                Welcome, {session.user.name ?? session.user.email}. You have no
                trips yet.
              </p>
              <p className="mt-1 text-sm text-zinc-400">
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
    completed: 'bg-zinc-100 text-zinc-600',
  };

  return (
    <li>
      <Link
        href={`/trips/${trip.id}`}
        className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div>
          <p className="font-semibold text-zinc-900">{trip.name}</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Total budget: {formatMoney(trip.totalBudget)}
          </p>
          {trip.ringfencedLabel && (
            <p className="text-xs text-zinc-400">
              {trip.ringfencedLabel}: {formatMoney(trip.ringfencedAmount)}{' '}
              ringfenced
            </p>
          )}
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
