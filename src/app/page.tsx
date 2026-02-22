import Image from 'next/image';
import { auth } from '@/infrastructure/auth';
import { SignInButton } from '@/ui/components/SignInButton';
import { SignOutButton } from '@/ui/components/SignOutButton';

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8">
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

        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xl text-zinc-700">
            Welcome, {session.user.name ?? session.user.email}.
          </p>
          <p className="mt-2 text-zinc-500">You have no trips yet.</p>
          <button
            type="button"
            className="mt-6 rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Create Trip
          </button>
        </div>
      </div>
    </main>
  );
}
