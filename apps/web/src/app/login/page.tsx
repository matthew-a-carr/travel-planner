import { redirect } from 'next/navigation';
import { auth } from '@/infrastructure/auth';
import { getVisibleSignInProviders } from '@/infrastructure/auth/provider-availability';
import { SignInButton } from '@/ui/components/SignInButton';

type LoginPageSearchParams = {
  error?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<LoginPageSearchParams> | LoginPageSearchParams;
}) {
  const session = await auth();
  const { showGoogle, showLocalDev } = getVisibleSignInProviders();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const errorMessage =
    resolvedSearchParams?.error === 'AccessDenied'
      ? 'Access denied. Your account is not approved for this app yet.'
      : null;

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
        <SignInButton
          showGoogle={showGoogle}
          showLocalDev={showLocalDev}
          errorMessage={errorMessage}
        />
      </div>
    </main>
  );
}
