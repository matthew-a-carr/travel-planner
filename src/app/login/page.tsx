import { redirect } from 'next/navigation';
import { auth } from '@/infrastructure/auth';
import { SignInButton } from '@/ui/components/SignInButton';

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Travel Planner</h1>
          <p className="mt-3 text-lg text-zinc-600">Sign in to plan your trip.</p>
        </div>
        <SignInButton />
      </div>
    </main>
  );
}
