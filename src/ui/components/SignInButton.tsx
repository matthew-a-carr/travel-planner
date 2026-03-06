'use client';

import { signIn } from 'next-auth/react';

type SignInButtonProps = {
  showGoogle: boolean;
  showLocalDev: boolean;
  errorMessage?: string | null;
};

export function SignInButton({ showGoogle, showLocalDev, errorMessage = null }: SignInButtonProps) {
  if (!showGoogle && !showLocalDev) {
    return (
      <div className="space-y-3">
        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sign-in is unavailable. Configure Google OAuth credentials to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {errorMessage && (
        <p className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
      {showLocalDev && (
        <button
          type="button"
          onClick={() => signIn('local-dev', { redirectTo: '/' })}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          Sign in locally (dev)
        </button>
      )}

      {showGoogle && (
        <button
          type="button"
          onClick={() => signIn('google')}
          className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
